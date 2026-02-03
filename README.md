# Mahspecy Websocket Bridge

## Project Description
Mahspecy Websocket Bridge is a powerful tool for integrating WebSocket interactions within your applications. It allows seamless communication between clients and servers using WebSocket protocols.

## Features
- Real-time data communication
- Easy integration with existing applications
- Support for multiple WebSocket connections

## Prerequisites
- Node.js (>= 14.x)
- npm (>= 6.x)
- A Railway account for deployment

## Installation Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/kitwalker14/mahspeccy-websocket-bridge.git
   cd mahspeccy-websocket-bridge
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```

## Configuration
- Create a `.env` file in the root of the project:
  ```bash
  PORT=3000
  WS_URL=wss://your-websocket-url
  ```

## Deployment Commands for Railway
1. Install the Railway CLI:
   ```bash
   npm install -g railway
   ```
2. Login to Railway:
   ```bash
   railway login
   ```
3. Deploy the application:
   ```bash
   railway up
   ```

## Local Development Setup
1. Start the server:
   ```bash
   npm start
   ```
2. Open your browser and navigate to `http://localhost:3000`

## Project Structure
```
mahspeccy-websocket-bridge/
├── src/
│   ├── index.js         # Entry point of the application
│   ├── websocket.js      # WebSocket handling logic
│   └── ...              # Other modules
├── .env                  # Environment variables
├── package.json          # Node.js dependencies
└── README.md             # Documentation
```

## Environment Variables
- `PORT`: Port for the application to run on
- `WS_URL`: WebSocket URL for the application

## Troubleshooting Guide
- **Cannot connect to WebSocket**: Ensure that the `WS_URL` is correctly defined in your `.env` file.
- **Port issues**: If your application does not start, check if the port is available.
- **Dependency errors**: Ensure you run `npm install` to install all necessary packages.