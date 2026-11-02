import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;

public class MainTest {
    private static final HttpClient CLIENT = HttpClient.newHttpClient();

    public static void main(String[] args) throws Exception {
        Path root = Files.createTempDirectory("scouting-sprocket-test");
        int port = freePort();
        Process server = null;
        try {
            server = startServer(root, port);
            String token = "{\"name\":\"Test\",\"sections\":[],\"responses\":[]}";

            assertStatus(post(port, "/import-token", token), 200);
            assertTrue(Files.isRegularFile(root.resolve("data.token")),
                "data.token should persist after import");

            assertStatus(post(port, "/import-token", "{\"sections\":"), 400);
            assertStatus(post(port, "/import-token", "x".repeat(1_048_577)), 413);
            assertStatus(post(port, "/settings/lock",
                "{\"action\":\"lock\",\"password\":\"test\"}"), 200);
            assertStatus(post(port, "/import-token", token), 423);

            stopServer(server);
            server = startServer(root, port);
            String persisted = get(port, "/form-token").body();
            assertTrue(persisted.contains("\"enabled\":true"),
                "lock state should persist across restart");
            assertTrue(Files.isRegularFile(root.resolve("data.token.bak")),
                "writes should create data.token.bak");

            assertStatus(post(port, "/settings/lock",
                "{\"action\":\"unlock\",\"password\":\"test\"}"), 200);
            assertStatus(post(port, "/import-token", token), 200);
            System.out.println("MainTest passed.");
        } finally {
            if (server != null && server.isAlive()) {
                stopServer(server);
            }
            deleteTree(root);
        }
    }

    private static Process startServer(Path root, int port)
        throws IOException, InterruptedException {
        String java = Path.of(System.getProperty("java.home"), "bin", "java.exe")
            .toString();
        String classPath = Path.of(System.getProperty("java.class.path"))
            .toAbsolutePath()
            .toString();
        Process process = new ProcessBuilder(
            java,
            "-cp",
            classPath,
            "-Dscouting.port=" + port,
            "-Dscouting.root=" + root,
            "Main"
        ).redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.INHERIT).start();
        for (int attempt = 0; attempt < 50; attempt++) {
            try {
                if (get(port, "/form-token").statusCode() > 0) {
                    return process;
                }
            } catch (IOException error) {
                if (!process.isAlive()) {
                    throw new IOException("Main exited before starting.", error);
                }
            }
            Thread.sleep(100);
        }
        process.destroyForcibly();
        throw new IOException("Main did not start in time.");
    }

    private static void stopServer(Process process) throws InterruptedException {
        process.destroy();
        if (!process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS)) {
            process.destroyForcibly();
            process.waitFor();
        }
    }

    private static HttpResponse<String> get(int port, String path)
        throws IOException, InterruptedException {
        return CLIENT.send(
            HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .GET()
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }

    private static HttpResponse<String> post(int port, String path, String body)
        throws IOException, InterruptedException {
        return CLIENT.send(
            HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build(),
            HttpResponse.BodyHandlers.ofString()
        );
    }

    private static int freePort() throws IOException {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        }
    }

    private static void assertStatus(HttpResponse<String> response, int expected) {
        assertTrue(response.statusCode() == expected,
            "expected HTTP " + expected + " but got " + response.statusCode());
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static void deleteTree(Path root) throws IOException {
        if (Files.exists(root)) {
            try (var paths = Files.walk(root)) {
                paths.sorted(Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException error) {
                            throw new RuntimeException(error);
                        }
                    });
            }
        }
    }
}
