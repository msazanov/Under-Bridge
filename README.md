
# Project Name: VPN Bridge Bot

## Table of Contents
- [Project Overview](#project-overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
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
- **Deletion**: Ability to delete locals and users with confirmation prompts.
- **Session Management**: Utilizes session middleware for tracking user states.
- **Error Handling**: Comprehensive error handling with informative messages.
- **Logging**: Detailed logging using Winston for monitoring bot activities.

---

## Installation

### Prerequisites

- **Node.js**: Make sure you have Node.js (version 12 or higher) installed.
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

   Ensure your PostgreSQL server is running and execute the SQL scripts to create necessary tables. (SQL scripts are not included in this repository and need to be created based on the `db.js` file schema.)

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
   - User deletion functionality will be added in future updates.

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

### Upcoming Features

- **Extended Local Settings**
  - [ ] **Change Local Type**
  - [ ] **Port Policy**
  - [ ] **Visibility Policy**
  - [ ] **Rename Local**
  - [ ] **Delete Local**
  - [ ] **Back**

- **User Settings**
  - For each user:
    - [ ] **Rename User**
    - [ ] **Delete User**
    - [ ] **Change Network Protocol**
    - **Port and Visibility Settings**
      - [ ] **Port Policy**
        - [ ] **All Ports Open**
        - [ ] **All Ports Closed**
        - [ ] **Open Specific Ports**
        - [ ] **Back**
      - [ ] **Visibility Policy**
        - [ ] **All Users Can See Me**
        - [ ] **No One Can See Me**
        - [ ] **Only Specific Users Can See Me**
        - [ ] **Back**
    - [ ] **Back**
  - [ ] **Create User**
  - [ ] **Back**

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
