import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class Main {

    private static final int PORT = configuredPort();
    private static final int MAX_PAYLOAD_BYTES = 1024 * 1024;
    private static final Path WEB_ROOT =
        Path.of(System.getProperty("scouting.root", System.getProperty("user.dir")))
            .toAbsolutePath()
            .normalize();
    private static final Path TOKEN_FILE = WEB_ROOT.resolve("data.token");
    private static final Path BACKUP_FILE = WEB_ROOT.resolve("data.token.bak");
    private static HttpServer server;

    public static void main(String[] args) throws IOException {
        server = HttpServer.create(
            new InetSocketAddress(PORT),
            0
        );

        server.createContext("/Builder_Form_reponse", Main::saveForm);
        server.createContext("/Data_actions_config", Main::saveForm);
        server.createContext("/import-token", Main::importToken);
        server.createContext("/settings/wipe", Main::wipeToken);
        server.createContext("/settings/lock", Main::manageLock);
        server.createContext("/form-token", Main::readToken);
        server.createContext("/Form_response", Main::formResponse);
        server.createContext("/", Main::serveFile);

        server.start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            if (server != null) {
                server.stop(1);
            }
        }, "scouting-server-shutdown"));
        System.out.println("http://localhost:" + PORT);
        System.out.println("Persistent token file: " + TOKEN_FILE);
        System.out.println("Token backup file: " + BACKUP_FILE);
    }

    private static int configuredPort() {
        String value = System.getProperty("scouting.port", "8080");
        try {
            int port = Integer.parseInt(value);
            if (port < 1 || port > 65535) {
                throw new NumberFormatException();
            }
            return port;
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException(
                "scouting.port must be a number from 1 to 65535.",
                error
            );
        }
    }

    private static void saveForm(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "POST");
            respond(exchange, 405, "Method Not Allowed", "text/plain; charset=UTF-8");
            return;
        }

        if ("/Builder_Form_reponse".equals(exchange.getRequestURI().getPath()) &&
            isLocked()) {
            respond(
                exchange,
                423,
                "The form and Settings are locked.",
                "text/plain; charset=UTF-8"
            );
            return;
        }

        String contentType = exchange.getRequestHeaders()
            .getFirst("Content-Type");

        if (contentType == null ||
            !contentType.toLowerCase().startsWith("application/json")) {
            respond(
                exchange,
                415,
                "Content-Type must be application/json.",
                "text/plain; charset=UTF-8"
            );
            return;
        }

        try {
            byte[] payload = readPayload(exchange.getRequestBody());
            String json = new String(payload, StandardCharsets.UTF_8).trim();

            if (!isValidToken(json)) {
                respond(
                    exchange,
                    400,
                    "The request body must be a valid token with a sections array.",
                    "text/plain; charset=UTF-8"
                );
                return;
            }

            writeToken(payload);
            respond(
                exchange,
                200,
                "{\"ok\":true}",
                "application/json; charset=UTF-8"
            );
        } catch (PayloadTooLargeException error) {
            respond(
                exchange,
                413,
                "The form is too large to save (maximum 1 MiB).",
                "text/plain; charset=UTF-8"
            );
        } catch (IOException error) {
            error.printStackTrace();
            respond(
                exchange,
                500,
                "The form could not be saved.",
                "text/plain; charset=UTF-8"
            );
        }
    }

    private static void readToken(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "GET");
            respond(exchange, 405, "Method Not Allowed", "text/plain; charset=UTF-8");
            return;
        }

        if (!Files.isRegularFile(TOKEN_FILE)) {
            respond(exchange, 404, "No saved form exists.", "text/plain; charset=UTF-8");
            return;
        }

        respond(
            exchange,
            200,
            Files.readString(TOKEN_FILE, StandardCharsets.UTF_8),
            "application/json; charset=UTF-8"
        );
    }

    private static void importToken(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "POST");
            respond(exchange, 405, "Method Not Allowed", "text/plain; charset=UTF-8");
            return;
        }

        if (isLocked()) {
            respond(exchange, 423, "The system is locked.", "text/plain; charset=UTF-8");
            return;
        }

        String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
        if (contentType == null ||
            !contentType.toLowerCase().startsWith("application/json")) {
            respond(exchange, 415, "Content-Type must be application/json.", "text/plain; charset=UTF-8");
            return;
        }

        try {
            byte[] payload = readPayload(exchange.getRequestBody());
            String json = new String(payload, StandardCharsets.UTF_8).trim();
            if (!isValidToken(json)) {
                respond(exchange, 400, "The import must be a valid token with a sections array.", "text/plain; charset=UTF-8");
                return;
            }
            writeToken(payload);
            respond(exchange, 200, "{\"ok\":true}", "application/json; charset=UTF-8");
        } catch (PayloadTooLargeException error) {
            respond(exchange, 413, "The import is too large.", "text/plain; charset=UTF-8");
        }
    }

    private static void wipeToken(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "POST");
            respond(exchange, 405, "Method Not Allowed", "text/plain; charset=UTF-8");
            return;
        }

        if (isLocked()) {
            respond(exchange, 423, "Settings are locked.", "text/plain; charset=UTF-8");
            return;
        }

        writeToken("{}".getBytes(StandardCharsets.UTF_8));
        respond(
            exchange,
            200,
            "{\"ok\":true}",
            "application/json; charset=UTF-8"
        );
    }

    private static void manageLock(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "POST");
            respond(exchange, 405, "Method Not Allowed", "text/plain; charset=UTF-8");
            return;
        }

        try {
            String request = new String(
                readPayload(exchange.getRequestBody()),
                StandardCharsets.UTF_8
            );
            String action = jsonStringField(request, "action");
            String password = jsonStringField(request, "password");

            if (password == null || password.isBlank()) {
                respond(exchange, 400, "A password is required.", "text/plain; charset=UTF-8");
                return;
            }

            String token = Files.isRegularFile(TOKEN_FILE)
                ? Files.readString(TOKEN_FILE, StandardCharsets.UTF_8)
                : "{}";
            String storedPassword = jsonStringField(token, "password");

            if ("unlock".equals(action)) {
                if (!isLockedToken(token) ||
                    storedPassword == null ||
                    !storedPassword.equals(password)) {
                    respond(exchange, 403, "Incorrect password.", "text/plain; charset=UTF-8");
                    return;
                }
                writeToken(setLock(token, false, storedPassword).getBytes(StandardCharsets.UTF_8));
            } else if ("lock".equals(action)) {
                writeToken(setLock(token, true, password).getBytes(StandardCharsets.UTF_8));
            } else {
                respond(exchange, 400, "Unknown lock action.", "text/plain; charset=UTF-8");
                return;
            }

            respond(exchange, 200, "{\"ok\":true}", "application/json; charset=UTF-8");
        } catch (PayloadTooLargeException error) {
            respond(exchange, 413, "The request is too large.", "text/plain; charset=UTF-8");
        }
    }

    private static boolean isLocked() throws IOException {
        return Files.isRegularFile(TOKEN_FILE) &&
            isLockedToken(Files.readString(TOKEN_FILE, StandardCharsets.UTF_8));
    }

    private static boolean isLockedToken(String token) {
        return token.matches("(?s).*\"lock\"\\s*:\\s*\\{[^}]*\"enabled\"\\s*:\\s*true[^}]*\\}.*");
    }

    private static String setLock(String token, boolean enabled, String password) {
        String lock = "\"lock\":{\"enabled\":" + enabled +
            ",\"password\":\"" + escapeJson(password) + "\"}";
        String replaced = token.replaceFirst(
            "(?s)\"lock\"\\s*:\\s*\\{[^{}]*\\}",
            Matcher.quoteReplacement(lock)
        );
        if (!replaced.equals(token)) {
            return replaced;
        }
        int end = token.lastIndexOf('}');
        if (end < 0) {
            return "{" + lock + "}";
        }
        return token.substring(0, end) + "," + lock + token.substring(end);
    }

    private static String jsonStringField(String json, String field) {
        Pattern pattern = Pattern.compile(
            "\"" + Pattern.quote(field) + "\"\\s*:\\s*\"((?:\\\\.|[^\"\\\\])*)\""
        );
        Matcher matcher = pattern.matcher(json);
        if (!matcher.find()) {
            return null;
        }
        return matcher.group(1)
            .replace("\\\"", "\"")
            .replace("\\\\", "\\");
    }

    private static String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void formResponse(HttpExchange exchange) throws IOException {
        if ("GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            readToken(exchange);
            return;
        }

        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "GET, POST");
            respond(exchange, 405, "Method Not Allowed", "text/plain; charset=UTF-8");
            return;
        }

        String contentType = exchange.getRequestHeaders()
            .getFirst("Content-Type");

        if (contentType == null ||
            !contentType.toLowerCase().startsWith("application/json")) {
            respond(
                exchange,
                415,
                "Content-Type must be application/json.",
                "text/plain; charset=UTF-8"
            );
            return;
        }

        try {
            byte[] payload = readPayload(exchange.getRequestBody());
            String json = new String(payload, StandardCharsets.UTF_8).trim();

            if (!isValidToken(json)) {
                respond(
                    exchange,
                    400,
                    "The response payload must be a valid token with a sections array.",
                    "text/plain; charset=UTF-8"
                );
                return;
            }

            writeToken(payload);
            respond(
                exchange,
                200,
                "{\"ok\":true}",
                "application/json; charset=UTF-8"
            );
        } catch (PayloadTooLargeException error) {
            respond(
                exchange,
                413,
                "The responses are too large to save (maximum 1 MiB).",
                "text/plain; charset=UTF-8"
            );
        }
    }

    private static byte[] readPayload(InputStream input)
        throws IOException, PayloadTooLargeException {

        try (InputStream request = input;
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int count;

            while ((count = request.read(buffer)) != -1) {
                total += count;

                if (total > MAX_PAYLOAD_BYTES) {
                    throw new PayloadTooLargeException();
                }

                output.write(buffer, 0, count);
            }

            return output.toByteArray();
        }
    }

    private static boolean isValidToken(String json) {
        try {
            JsonCursor cursor = new JsonCursor(json);
            cursor.parseValue();
            cursor.skipWhitespace();
            if (!cursor.atEnd() || !cursor.wasObject()) {
                return false;
            }
            return cursor.objectHasArray("sections");
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    private static void writeToken(byte[] payload) throws IOException {
        writeFileAtomically(TOKEN_FILE, payload);
    }

    private static void writeFileAtomically(Path target, byte[] payload)
        throws IOException {

        if (Files.isRegularFile(target)) {
            Files.copy(target, BACKUP_FILE, StandardCopyOption.REPLACE_EXISTING);
        }

        Path temporaryFile = Files.createTempFile(
            WEB_ROOT,
            "data",
            ".token.tmp"
        );

        try {
            Files.write(temporaryFile, payload);

            try {
                Files.move(
                    temporaryFile,
                    target,
                    StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING
                );
            } catch (AtomicMoveNotSupportedException error) {
                Files.move(
                    temporaryFile,
                    target,
                    StandardCopyOption.REPLACE_EXISTING
                );
            }
        } finally {
            Files.deleteIfExists(temporaryFile);
        }
    }

    private static final class JsonCursor {
        private final String text;
        private int index;
        private int objectDepth;
        private boolean object;
        private boolean sectionsArray;

        JsonCursor(String text) {
            this.text = text;
        }

        boolean wasObject() {
            return object;
        }

        boolean objectHasArray(String field) {
            return sectionsArray;
        }

        boolean atEnd() {
            return index == text.length();
        }

        void skipWhitespace() {
            while (index < text.length() &&
                Character.isWhitespace(text.charAt(index))) {
                index++;
            }
        }

        void parseValue() {
            skipWhitespace();
            if (index >= text.length()) {
                throw invalid();
            }
            char value = text.charAt(index);
            if (value == '{') {
                parseObject();
            } else if (value == '[') {
                parseArray();
            } else if (value == '"') {
                parseString();
            } else if (value == 't') {
                parseLiteral("true");
            } else if (value == 'f') {
                parseLiteral("false");
            } else if (value == 'n') {
                parseLiteral("null");
            } else if (value == '-' || Character.isDigit(value)) {
                parseNumber();
            } else {
                throw invalid();
            }
        }

        private void parseObject() {
            int currentDepth = objectDepth++;
            if (currentDepth == 0) {
                object = true;
            }
            index++;
            skipWhitespace();
            if (consume('}')) {
                objectDepth--;
                return;
            }
            while (true) {
                skipWhitespace();
                if (index >= text.length() || text.charAt(index) != '"') {
                    throw invalid();
                }
                String key = parseString();
                skipWhitespace();
                require(':');
                int valueStart = index;
                parseValue();
                if (currentDepth == 0 && "sections".equals(key) &&
                    valueStart < text.length() &&
                    text.charAt(valueStart) == '[') {
                    sectionsArray = true;
                }
                skipWhitespace();
                if (consume('}')) {
                    objectDepth--;
                    return;
                }
                require(',');
            }
        }

        private void parseArray() {
            index++;
            skipWhitespace();
            if (consume(']')) {
                return;
            }
            while (true) {
                parseValue();
                skipWhitespace();
                if (consume(']')) {
                    return;
                }
                require(',');
            }
        }

        private String parseString() {
            require('"');
            StringBuilder result = new StringBuilder();
            while (index < text.length()) {
                char value = text.charAt(index++);
                if (value == '"') {
                    return result.toString();
                }
                if (value == '\\') {
                    if (index >= text.length()) {
                        throw invalid();
                    }
                    char escaped = text.charAt(index++);
                    if (escaped == 'u') {
                        if (index + 4 > text.length()) {
                            throw invalid();
                        }
                        String hex = text.substring(index, index + 4);
                        if (!hex.matches("[0-9a-fA-F]{4}")) {
                            throw invalid();
                        }
                        result.append((char) Integer.parseInt(hex, 16));
                        index += 4;
                    } else if ("\"\\/bfnrt".indexOf(escaped) >= 0) {
                        result.append(escaped);
                    } else {
                        throw invalid();
                    }
                } else if (value < 0x20) {
                    throw invalid();
                } else {
                    result.append(value);
                }
            }
            throw invalid();
        }

        private void parseNumber() {
            int start = index;
            if (consume('-')) {
                // sign consumed
            }
            if (consume('0')) {
                // zero consumed
            } else {
                requireDigits();
            }
            if (consume('.')) {
                requireDigits();
            }
            if (index < text.length() &&
                (text.charAt(index) == 'e' || text.charAt(index) == 'E')) {
                index++;
                if (index < text.length() &&
                    (text.charAt(index) == '+' || text.charAt(index) == '-')) {
                    index++;
                }
                requireDigits();
            }
            if (start == index) {
                throw invalid();
            }
        }

        private void requireDigits() {
            int start = index;
            while (index < text.length() && Character.isDigit(text.charAt(index))) {
                index++;
            }
            if (start == index) {
                throw invalid();
            }
        }

        private void parseLiteral(String literal) {
            if (!text.startsWith(literal, index)) {
                throw invalid();
            }
            index += literal.length();
        }

        private boolean consume(char expected) {
            if (index < text.length() && text.charAt(index) == expected) {
                index++;
                return true;
            }
            return false;
        }

        private void require(char expected) {
            if (!consume(expected)) {
                throw invalid();
            }
        }

        private IllegalArgumentException invalid() {
            return new IllegalArgumentException("Invalid JSON at " + index);
        }
    }

    private static void serveFile(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod()) &&
            !"HEAD".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "GET, HEAD");
            respond(exchange, 405, "Method Not Allowed", "text/plain; charset=UTF-8");
            return;
        }

        String requestPath = exchange.getRequestURI().getPath();

        if (requestPath == null || requestPath.contains("..")) {
            respond(exchange, 400, "Invalid path.", "text/plain; charset=UTF-8");
            return;
        }

        String relativePath =
            requestPath.equals("/") ? "index.html" : requestPath.substring(1);
        Path file = WEB_ROOT.resolve(relativePath).normalize();

        if (!file.startsWith(WEB_ROOT) ||
            !Files.isRegularFile(file) ||
            file.equals(TOKEN_FILE) ||
            file.equals(BACKUP_FILE) ||
            file.getFileName().toString().endsWith(".token.tmp")) {
            respond(exchange, 404, "Not Found", "text/plain; charset=UTF-8");
            return;
        }

        byte[] content = Files.readAllBytes(file);
        exchange.getResponseHeaders().set(
            "Content-Type",
            contentType(file)
        );
        exchange.sendResponseHeaders(
            200,
            "HEAD".equalsIgnoreCase(exchange.getRequestMethod())
                ? -1
                : content.length
        );

        if (!"HEAD".equalsIgnoreCase(exchange.getRequestMethod())) {
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(content);
            }
        } else {
            exchange.close();
        }
    }

    private static String contentType(Path file) {
        Map<String, String> types = Map.of(
            ".html", "text/html; charset=UTF-8",
            ".css", "text/css; charset=UTF-8",
            ".js", "text/javascript; charset=UTF-8",
            ".png", "image/png",
            ".jpg", "image/jpeg",
            ".jpeg", "image/jpeg"
        );

        String fileName = file.getFileName().toString().toLowerCase();
        int extensionStart = fileName.lastIndexOf('.');
        return extensionStart >= 0
            ? types.getOrDefault(
                fileName.substring(extensionStart),
                "application/octet-stream"
            )
            : "application/octet-stream";
    }

    private static void respond(
        HttpExchange exchange,
        int status,
        String body,
        String contentType
    ) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(status, bytes.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static final class PayloadTooLargeException extends Exception {
    }
}
