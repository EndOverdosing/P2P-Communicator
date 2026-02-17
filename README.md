![Palyra Banner](/images/banner-rounded.png)

# Palyra

**Secure, decentralized, real-time communication.**

A modern peer-to-peer messaging platform that combines end-to-end encrypted messaging, video calls, and server-based chat rooms. Built with privacy and security at its core.

## Overview

Palyra is a full-featured communication platform that enables users to connect through secure, private channels. Using WebRTC for peer-to-peer video calls and Supabase for real-time messaging infrastructure, Palyra offers a seamless experience without compromising on security or performance.

## Key Features

### Security & Privacy
- **End-to-end encrypted** peer-to-peer video calls
- **Secure authentication** with fingerprint tracking
- **Bot detection** and rate limiting
- **User blocking** and privacy controls

### Messaging
- **Real-time text messaging** with typing indicators
- **File sharing** with automatic image compression
- **Message reactions** and replies
- **Link previews** with automatic URL detection
- **Message editing** and deletion

### Video Calls
- **High-quality video and audio** streaming
- **Screen sharing** capabilities
- **Camera switching** on mobile devices
- **Call duration tracking**

### Servers
- **Public and private servers** for group communication
- **Server management** with owner controls
- **Member moderation** (kick/ban functionality)

### User Experience
- **Responsive design** for desktop and mobile
- **Dark/light theme** support
- **Customizable font sizes**
- **Real-time online status** indicators
- **Read receipts** and message notifications

## Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **Real-time Communication:** WebRTC via PeerJS
- **Backend:** Supabase (PostgreSQL, Realtime, Storage, Auth)
- **UI Icons:** Font Awesome 6
- **Styling:** Custom CSS with CSS Variables

## Installation

### Prerequisites
- Node.js (for development server)
- Supabase account and project

### Setup

1. **Clone the repository:**
```bash
   git clone https://github.com/endoverdosing/palyra.git
   cd palyra
```

2. **Configure environment variables:**
   Create a `.env` file in the root directory:
```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. **Install dependencies:**
```bash
   npm install
```

4. **Run the development server:**
```bash
   npm run dev
```

5. **Open the application:**
   Navigate to `http://localhost:3000` in your browser.

## Database Schema

Required Supabase tables:
- `profiles` - User profiles and authentication
- `friendships` - Friend connections and requests
- `messages` - Direct messages between users
- `server_messages` - Server/group messages
- `servers` - Server/group chat metadata
- `server_members` - Server membership tracking
- `blocked_users` - User blocking functionality
- `notifications` - In-app notifications
- `link_previews` - Cached URL previews

## Usage

### Getting Started
1. **Sign up** with a unique username and secure password
2. **Add friends** by searching for their usernames
3. **Start chatting** with direct messages or create/join servers

### Making Calls
1. Open a chat with a friend
2. Click the video call button
3. Wait for the other user to accept
4. Use controls to mute, disable video, or share your screen

### Creating Servers
1. Navigate to the **Global** tab
2. Click the **+ button**
3. Choose between public or private (password-protected)
4. Invite friends or share the server ID

## Security Features

- **Rate limiting** on login attempts, messages, and friend requests
- **Bot detection** with honeypot fields and user interaction tracking
- **Session fingerprinting** for anomaly detection
- **Account lockout** after failed login attempts
- **Input sanitization** to prevent XSS attacks

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers with WebRTC support

**Note:** HTTPS is required for video calling features. Use localhost for development or deploy with SSL/TLS.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **PeerJS** for simplifying WebRTC implementation
- **Supabase** for real-time backend infrastructure
- **Font Awesome** for iconography

## Support

- Discord: [Join our community](https://discord.gg/94KwX2ZtzK)
- Issues: [GitHub Issues](https://github.com/endoverdosing/palyra/issues)

---

Built with ❤️ for secure, private communication.