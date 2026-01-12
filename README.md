# Life Command Center

A comprehensive productivity command center for managing tasks, projects, goals, and time.

## 🚀 Features

### Core Productivity Tools
- **Task Management**: Create, edit, filter, and track tasks with priorities and categories
- **Time Blocking**: Visual hourly schedule (6 AM - 11 PM) with automatic task detection
- **Active Focus Mode**: Auto-detects current task based on time blocks with countdown timer
- **Smart Filtering**: Filter by All, Today, Upcoming, or High Priority
- **Real-time Search**: Instant task search by title or category

### Project & Goal Tracking
- **Projects Module**: Track projects with progress bars and task linking
- **Goals System**: Set goals with deadlines and progress tracking
- **Learning Module**: Manage courses and study progress

### Advanced Features
- **Daily Planning**: "Plan Tomorrow" view for scheduling ahead
- **Keyboard Shortcuts**: 
  - `Ctrl+K`: Quick add task
  - `Esc`: Close modals
- **Theme Toggle**: Switch between light and dark modes
- **Browser Notifications**: Get notified about tasks
- **Progress Analytics**: Real-time productivity score

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (CSS Variables, Flexbox, Grid)
- **JavaScript**: ES6+ (Async/Await, Arrow Functions)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Fonts**: Space Grotesk, Inter (Google Fonts)

## 📦 Setup

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Firebase account (free tier works)

### Installation

1. Clone this repository:
```bash
git clone https://github.com/YOUR_USERNAME/Life_Command_Center.git
cd Life_Command_Center
```

2. Open `index.html` in your browser:
```bash
# On Windows
start index.html

# On macOS
open index.html

# On Linux
xdg-open index.html
```

### Firebase Configuration

The app currently uses a shared Firebase project for demonstration. For production use:

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Email/Password authentication
3. Create a Firestore database
4. Replace the `firebaseConfig` in `script.js` with your project credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    // ... other config
};
```

## 🎯 Usage

### Getting Started
1. **Sign Up**: Create an account with your email
2. **Create Tasks**: Use the "+ Quick Task" button or press `Ctrl+K`
3. **Schedule Tasks**: Add time blocks to tasks for automatic focus detection
4. **Organize**: Create projects and goals to group related tasks
5. **Plan Ahead**: Use "Plan Tomorrow" to prepare for the next day

### Task Categories
- 💼 **Work**: Professional tasks
- 📚 **Study**: Learning and education
- 🚀 **Project**: Project-related work
- 🏠 **Personal**: Personal activities

### Priority Levels
- **High**: Urgent and important
- **Medium**: Normal priority
- **Low**: Can be deferred

## 📊 Data Structure

### Collections in Firestore
- `users`: User profiles
- `tasks`: Task items with metadata
- `projects`: Project tracking
- `goals`: Long-term objectives
- `learning_courses`: Course management

## 🎨 Customization

### Themes
Toggle between light and dark modes using the 🌓 button in the sidebar footer.

### Color Scheme
Edit CSS variables in `styles.css` to customize colors:
```css
:root {
    --accent-primary: #238636;
    --accent-blue: #58a6ff;
    /* ... more variables */
}
```

## 🔒 Security Notes

⚠️ **Important**: The current Firebase configuration is for demonstration only. For production:
- Create your own Firebase project
- Enable security rules in Firestore
- Use environment variables for sensitive data
- Implement proper authentication flows

## 📝 License

MIT License - feel free to use this for personal or commercial projects.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ for productivity enthusiasts**
