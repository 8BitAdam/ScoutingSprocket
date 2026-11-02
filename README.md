# Scouting Sprocket

Scouting Sprocket is a browser-based scouting form manager. It provides pages for building and filling out forms, importing and exporting form data, managing stored data, and configuring settings.

## Requirements

- Java 11 or newer
- A modern web browser

The server uses only Java's standard library; no external dependencies are required.

## Run the application

From the repository directory, compile and start the server:

```powershell
javac Main.java
java Main
```

The application automatically opens <http://localhost:8080> in the system browser. If the browser cannot be opened automatically, visit that address manually.

The server prints its URL and the locations of the persistent token files when it starts.

### Configuration

The default port is `8080`. Override it with the `scouting.port` system property:

```powershell
java -Dscouting.port=8081 Main
```

By default, files are stored in the current working directory. Set `scouting.root` to use another directory:

```powershell
java -Dscouting.root=C:\path\to\scouting-data Main
```

The application stores the current form data in `data.token` and keeps the previous version in `data.token.bak`.

## Main pages

- **Dashboard**: application home page
- **Forms**: view and use the configured scouting forms
- **Builder**: create or update the form definition
- **Export**: export collected data
- **Import**: import a saved form or token
- **Data Actions**: perform actions on stored scouting data
- **Settings**: manage application settings, locking, and data wiping

## Run the integration test

Compile both Java files and run the test:

```powershell
javac Main.java MainTest.java
java MainTest
```

The test starts the server against a temporary data directory and verifies persistence, validation, size limits, locking, backups, and restart behavior.

## Data format

Imported and saved tokens must be valid JSON objects containing a `sections` array. The server rejects malformed JSON, unsupported content types, and payloads larger than 1 MiB.
