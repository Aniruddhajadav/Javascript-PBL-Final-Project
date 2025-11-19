-----

# Ani-Tool Hub

**Ani-Tool Hub** is a developer-centric, offline-first productivity suite designed as a Single Page Application (SPA). It consolidates essential daily tools—task management, note-taking, time tracking, and utilities—into a unified interface with a customizable "hacker/terminal" aesthetic.

## 🚀 Features

### 🔐 Authentication & Security

  * **Local Profiles:** Create multiple user profiles directly in the browser.
  * **Client-Side Encryption:** Passwords are hashed using SHA-256 before storage.
  * **Data Privacy:** All data persists locally via `localStorage`; no data is sent to the cloud.

### 📊 Interactive Dashboard

  * **Widgets:** View system time, "Agenda Today" (tasks due now), and productivity statistics at a glance.
  * **Customizable Layout:** Drag-and-drop widgets to rearrange the dashboard or toggle their visibility.

### 📝 Productivity Modules

  * **Smart Notes:** Markdown-style note-taking with search functionality, hashtag filtering (e.g., `#work`), and clipboard copying.
  * **To-Do List:** Add tasks with deadlines and tags. Sort tasks by "Newest" or "Deadline".
  * **Calendar:** A monthly view that visualizes pending tasks. Click any date to add tasks via a modal.

### ⏱️ Time Management

  * **Digital Clock:** Real-time display with date.
  * **Stopwatch:** Split-second precision recording.
  * **Countdown Timer:** Set customizable timers with visual alerts.

### 🛠️ Utilities

  * **Unit Converter:** Convert Length (m/ft), Temperature (C/F), Data Storage (MB/GB), and Number Bases (Decimal/Hexadecimal).
  * **Calculator:** Fully functional GUI calculator for arithmetic operations.

### 🎨 Personalization

  * **Theming:** Toggle between **Dark Mode** (default) and **Light Mode**.
  * **Appearance:** Customize accent colors, font scaling, and profile icons.

### 💾 Data Management

  * **Backup & Restore:** Export all user data (notes, tasks, settings) to a JSON file and import it to restore or migrate data.

-----

## 📂 Project Structure

  * **`index.html`**: The main skeleton of the application, containing the layout for all tabs (Dashboard, Clock, Notes, Todo, etc.).
  * **`style.css`**: Contains CSS variables for theming, flexbox/grid layouts, and the source code font styling.
  * **`script.js`**: Handles all logic, including DOM manipulation, LocalStorage management, hashing, and event listeners.

-----

## 👥 Beneficiaries

  * **Developers:** Who appreciate the terminal-like aesthetic and tools like the Hex/Decimal converter.
  * **Students:** For managing study schedules via the Calendar and performing quick calculations.
  * **Privacy Advocates:** Who prefer tools that do not track usage or store data on external servers.

-----

## 🔧 Installation & Usage

Since **Ani-Tool Hub** runs entirely on the client side, no server installation (Node.js, Python, etc.) is required.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/ani-tool-hub.git
    ```
2.  **Open the application:**
      * Navigate to the project folder.
      * Double-click `index.html` to open it in your default web browser.

-----

## 🛡️ Scope & Limitations

  * **Scope:** The project is strictly a browser-based application. It focuses on local persistence and utility tools.
  * **Limitations:** Data does not sync across devices automatically (requires manual JSON export/import). It is designed for single-device usage per session.

-----

## 🤝 Contributing

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

-----
