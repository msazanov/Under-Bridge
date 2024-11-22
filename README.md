
# Project Name: VPN Bridge Bot

## Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Development Guide](#development-guide)
- [To-Do List](#to-do-list)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview

VPN Bridge Bot is a Telegram bot designed to create and manage virtual private network (VPN) bridges, similar to services like Hamachi or Garena. The primary interface for users is through Telegram, providing a seamless and user-friendly experience. The bot allows users to create "locals" (virtual networks), add users to these locals, and manage various settings related to network visibility and port policies.

---

## Features

- **User Registration**: Automatic registration of users upon starting the bot.
- **Main Menu Navigation**: Easy navigation through the bot's functionalities using inline keyboards.
- **Local Creation**: Users can create new locals with custom or randomly generated names.
- **User Management**: Add users to locals with custom or randomly generated usernames.
- **Local Overview**: View details of locals, including IP networks and users within them.
- **Persistent Context**: Automatically save user context in the database, ensuring seamless interaction even after bot restarts.
- **Deletion**: Ability to delete locals and users with confirmation prompts.
- **Error Handling**: Comprehensive error handling with informative messages.
- **Logging**: Detailed logging using Winston for monitoring bot activities.
- **Database-Driven State Management**: All session states and user interactions are stored in PostgreSQL for reliability and scalability.

---

## Installation

### Prerequisites

- **Node.js**: Make sure you have Node.js (version 16 or higher) installed.
- **PostgreSQL**: A PostgreSQL database for storing user and local information.
- **Telegram Bot Token**: Obtain a bot token from [BotFather](https://t.me/BotFather) on Telegram.

### Steps

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/vpn-bridge-bot.git
   cd vpn-bridge-bot
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Configure Environment Variables**

   Create a `.env` file in the root directory and add your configuration:

   ```plaintext
   TELEGRAM_BOT_TOKEN=your-telegram-bot-token
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your-db-username
   DB_PASSWORD=your-db-password
   DB_NAME=your-db-name
   ```

   Replace the placeholders with your actual database credentials and Telegram bot token.

4. **Initialize the Database**

   Ensure your PostgreSQL server is running and execute the SQL scripts to create necessary tables. Tables are created automatically on the first run using the database initializer.

5. **Run the Bot**

   ```bash
   node bot.js
   ```

---

## Usage

1. **Start the Bot**

   Find your bot on Telegram using its username and press the **Start** button or send `/start`.

2. **Main Menu**

   - **My Locals**: View and manage your locals.
   - **Top Up**: Placeholder for future balance top-up functionality.

3. **Creating a Local**

   - From the main menu, select **My Locals**.
   - If you have no locals, you can create one by clicking **Create Local**.
   - Enter a name for your local or choose to generate a random one.

4. **Managing Users**

   - Within a local, you can add users by selecting **Create User**.
   - Provide a username or generate a random one.

5. **Deleting Locals and Users**

   - Delete a local by selecting **Delete Local** and confirming the action.
   - Delete a user by selecting **Delete User** from user settings.

---

## Development Guide

### Project Structure

```plaintext
.
├── bot.js                # Main entry point for the bot
├── config                # Configuration files and environment variables
│   └── index.js
├── handlers              # Command and action handlers
│   ├── commands
│   │   ├── helpCommand.js
│   │   ├── index.js
│   │   └── startCommand.js
│   └── actions
│       ├── adminActions.js
│       ├── index.js
│       ├── localActions.js
│       └── userActions.js
├── repositories          # Database interaction logic
│   ├── db.js
│   └── dbInitializer.js
├── services              # Core business logic
│   ├── localService.js
│   └── menu.js
├── utils                 # Utility functions and helpers
│   ├── logger.js
│   └── name-generator.js
├── .env                  # Environment variables
├── .gitignore            # Git ignore rules
├── package.json          # Node.js dependencies and scripts
├── README.md             # Documentation
└── EXAMPLE.env           # Example environment file
```

### Key Design Choices

1. **Modular Architecture**: 
   - Handlers are divided into commands and actions for better organization.
   - Each functionality is isolated into separate files, allowing for easy scaling and debugging.

2. **Database-Driven State**:
   - User sessions are stored in PostgreSQL for reliability across bot restarts.
   - State transitions are managed efficiently using database updates.

3. **Error Handling**:
   - Comprehensive logging ensures that errors are traceable.
   - User-friendly error messages are shown for smoother interaction.

4. **Scalability**:
   - Adding new commands or actions is simple due to the modular architecture.
   - The bot can handle concurrent user interactions effectively.

---

## To-Do List

### Existing Features and Buttons (Completed)

- **Main Menu Navigation**
  - [x] **My Locals**
  - [x] **Top Up** (placeholder)

- **Local Management**
  - [x] **Create Local**
  - [x] **Delete Local**

- **User Management**
  - [x] **Create User**
  - [x] **Rename User**
  - [x] **Delete User**

### Upcoming Features

- **Extended Local Settings**
  - [ ] **Change Local Type**
  - [ ] **Port Policy**
  - [ ] **Visibility Policy**
  - [ ] **Rename Local**

- **User Settings**
  - For each user:
    - [ ] **Change Network Protocol**
    - **Port and Visibility Settings**
      - [ ] **Port Policy**
        - [ ] **All Ports Open**
        - [ ] **All Ports Closed**
        - [ ] **Open Specific Ports**
      - [ ] **Visibility Policy**
        - [ ] **All Users Can See Me**
        - [ ] **No One Can See Me**
        - [ ] **Only Specific Users Can See Me**

- **Payment System**
  - [ ] Design a payment system for premium features.
  - [ ] Determine what functionalities will require payment.
  - [ ] Implement methods for users to deposit funds.

- **Backend VPN Logic**
  - [ ] Develop backend logic for VPN bridges.
  - [ ] Support multiple VPN protocols within a single local.
  - [ ] Implement port and visibility policies among users.
  - [ ] Ensure users can connect via different protocols simultaneously.

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or suggestions.

---

## License

This project is licensed under the MIT License.
