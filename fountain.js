/* Scouting Sprocket: fountain-code transfer.
   Export turns a token into an endless stream of small text frames (shown as QR codes).
   Import collects frames in any order, with gaps, and rebuilds the token once enough have arrived.

   Frame text:  SPRK1:<transfer id>:<pieces>:<bytes>:<crc32>:<compressed 0|1>:<seed>:<base64url data>

   The data is split into <pieces> equal blocks. Frames with seed < pieces carry one plain block.
   Every later seed carries the XOR of a few blocks, chosen by a seeded random generator, so any
   missing block can be rebuilt from other frames. The generator uses only integer maths and
   division/addition, so every browser picks exactly the same blocks for the same seed. */
(function (root) {
    "use strict";

    var BLOCK = 128;            // bytes of token data per QR code
    var PREFIX = "SPRK1";
    var MAX_PIECES = 5000;
    var MAX_BYTES = 8 * 1024 * 1024;

    /* ---------- Small helpers ---------- */
    var crcTable = (function () {
        var table = [];
        for (var n = 0; n < 256; n += 1) {
            var c = n;
            for (var k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        var c = 0xFFFFFFFF;
        for (var i = 0; i < bytes.length; i += 1) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }

    function hex8(n) { return ("00000000" + n.toString(16)).slice(-8); }

    function toB64(bytes) {
        var s = "";
        for (var i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
        return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    function fromB64(text) {
        var s = atob(text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4));
        var out = new Uint8Array(s.length);
        for (var i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
        return out;
    }

    function xorInto(target, source) {
        for (var i = 0; i < target.length; i += 1) target[i] ^= source[i];
    }

    /* ---------- Seeded random choice of blocks ---------- */
    function generator(transfer, seed) {
        var h = 2166136261;
        for (var i = 0; i < transfer.length; i += 1) h = Math.imul(h ^ transfer.charCodeAt(i), 16777619) >>> 0;
        var a = (h ^ Math.imul(seed + 1, 0x9E3779B1)) >>> 0;
        return function () {                       // mulberry32
            a = (a + 0x6D2B79F5) >>> 0;
            var t = Math.imul(a ^ (a >>> 15), a | 1);
            t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
            return (t ^ (t >>> 14)) >>> 0;
        };
    }

    var cdfCache = {};
    // Ideal soliton weights with a boost on degree 1: only +, / and comparisons, so results never differ between devices.
    function cdf(k) {
        if (cdfCache[k]) return cdfCache[k];
        var out = [];
        var total = 0;
        for (var d = 1; d <= k; d += 1) {
            total += d === 1 ? 2 / k : 1 / (d * (d - 1));
            out.push(total);
        }
        cdfCache[k] = out;
        return out;
    }

    function indicesFor(transfer, k, seed) {
        if (seed < k) return [seed];
        var next = generator(transfer, seed);
        var table = cdf(k);
        var u = (next() / 4294967296) * table[k - 1];
        var low = 0;
        var high = k - 1;
        while (low < high) {
            var mid = (low + high) >> 1;
            if (table[mid] >= u) high = mid; else low = mid + 1;
        }
        var degree = low + 1;
        var chosen = {};
        var list = [];
        while (list.length < degree) {
            var index = next() % k;
            if (!chosen[index]) { chosen[index] = true; list.push(index); }
        }
        return list;
    }

    /* ---------- Compression (when the browser has it) ---------- */
    async function pipe(bytes, stream) {
        var result = new Blob([bytes]).stream().pipeThrough(stream);
        return new Uint8Array(await new Response(result).arrayBuffer());
    }

    /* ---------- Sending ---------- */
    async function prepare(text) {
        var raw = new TextEncoder().encode(text);
        var payload = raw;
        var compressed = 0;
        if (typeof CompressionStream === "function") {
            var packed = await pipe(raw, new CompressionStream("deflate"));
            if (packed.length < raw.length) { payload = packed; compressed = 1; }
        }
        if (payload.length > MAX_BYTES) throw new Error("That token is too large to send as QR codes. Use the token file instead.");

        var k = Math.max(1, Math.ceil(payload.length / BLOCK));
        var padded = new Uint8Array(k * BLOCK);
        padded.set(payload);
        var id = "";
        var random = new Uint8Array(3);
        (root.crypto || {}).getRandomValues ? root.crypto.getRandomValues(random) : random.forEach(function (_, i) { random[i] = Math.floor(Math.random() * 256); });
        random.forEach(function (b) { id += ("0" + b.toString(16)).slice(-2); });
        var crc = hex8(crc32(payload));

        return {
            pieces: k,
            bytes: payload.length,
            compressed: compressed === 1,
            frame: function (seed) {
                var data = new Uint8Array(BLOCK);
                indicesFor(id, k, seed).forEach(function (index) {
                    xorInto(data, padded.subarray(index * BLOCK, (index + 1) * BLOCK));
                });
                return [PREFIX, id, k, payload.length, crc, compressed, seed, toB64(data)].join(":");
            }
        };
    }

    /* ---------- Receiving ---------- */
    function Receiver() { this.reset(); }

    Receiver.prototype.reset = function () {
        this.meta = null;
        this.blocks = [];
        this.waiting = [];
        this.known = 0;
        this.seen = {};
        this.frames = 0;
        this.complete = false;
        this.failed = false;
    };

    Receiver.prototype.add = function (text) {
        var parts = String(text).split(":");
        if (parts.length !== 8 || parts[0] !== PREFIX) return { ok: false };
        var meta = { id: parts[1], k: Number(parts[2]), bytes: Number(parts[3]), crc: parts[4], compressed: parts[5] === "1" };
        var seed = Number(parts[6]);
        if (!/^[0-9a-f]{6}$/.test(meta.id) || !/^[0-9a-f]{8}$/.test(meta.crc) ||
            !Number.isInteger(meta.k) || meta.k < 1 || meta.k > MAX_PIECES ||
            !Number.isInteger(meta.bytes) || meta.bytes < 1 || meta.bytes > MAX_BYTES ||
            !Number.isInteger(seed) || seed < 0) return { ok: false };
        var data;
        try { data = fromB64(parts[7]); } catch (e) { return { ok: false }; }
        if (data.length !== BLOCK) return { ok: false };

        if (!this.meta || this.meta.id !== meta.id) {        // a new transfer starts from scratch
            this.reset();
            this.meta = meta;
            this.blocks = new Array(meta.k).fill(null);
            this.waiting = new Array(meta.k).fill(null);
        }
        if (this.complete || this.seen[seed]) return this.status(false);
        this.seen[seed] = true;
        this.frames += 1;

        var remaining = [];
        var symbol = data;
        var self = this;
        indicesFor(meta.id, meta.k, seed).forEach(function (index) {
            if (self.blocks[index]) xorInto(symbol, self.blocks[index]); else remaining.push(index);
        });
        if (remaining.length) {
            var entry = { left: remaining, data: symbol };
            if (remaining.length === 1) this.solve(entry);
            else remaining.forEach(function (index) { (self.waiting[index] = self.waiting[index] || []).push(entry); });
        }
        if (this.known === meta.k) this.finish();
        return this.status(true);
    };

    // Peeling: a frame with one unknown block gives that block, which may unlock others.
    Receiver.prototype.solve = function (first) {
        var queue = [first];
        while (queue.length) {
            var entry = queue.pop();
            if (entry.left.length !== 1) continue;
            var index = entry.left[0];
            if (this.blocks[index]) continue;
            this.blocks[index] = entry.data;
            this.known += 1;
            entry.left = [];
            var list = this.waiting[index] || [];
            this.waiting[index] = null;
            for (var i = 0; i < list.length; i += 1) {
                var other = list[i];
                var at = other.left.indexOf(index);
                if (at === -1) continue;
                xorInto(other.data, this.blocks[index]);
                other.left.splice(at, 1);
                if (other.left.length === 1) queue.push(other);
            }
        }
    };

    Receiver.prototype.finish = function () {
        var meta = this.meta;
        var all = new Uint8Array(meta.k * BLOCK);
        for (var i = 0; i < meta.k; i += 1) all.set(this.blocks[i], i * BLOCK);
        var payload = all.subarray(0, meta.bytes);
        if (hex8(crc32(payload)) !== meta.crc) {
            this.reset();                                    // damaged: start collecting again
            this.failed = true;
            return;
        }
        this.payload = payload.slice();
        this.complete = true;
    };

    Receiver.prototype.status = function (isNew) {
        return { ok: true, isNew: isNew, pieces: this.meta ? this.meta.k : 0, known: this.known, frames: this.frames, complete: this.complete };
    };

    // Turns the finished payload back into the token text.
    Receiver.prototype.text = async function () {
        if (!this.complete) throw new Error("The transfer isn’t finished yet.");
        var bytes = this.payload;
        if (this.meta.compressed) {
            if (typeof DecompressionStream !== "function") throw new Error("This browser can’t unpack the transfer. Try a newer browser.");
            bytes = await pipe(bytes, new DecompressionStream("deflate"));
        }
        return new TextDecoder().decode(bytes);
    };

    root.SprocketFountain = { prepare: prepare, Receiver: Receiver, BLOCK: BLOCK };
})(typeof self !== "undefined" ? self : this);
