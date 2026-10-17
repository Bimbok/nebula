# Project Overview

This project is a web application that allows users to stream videos from their Google Drive. It is built with React, TypeScript, and Vite. The application uses the Google Drive API to list video files and stream them directly in the browser.

## Key Technologies

*   **Frontend:** React, TypeScript
*   **Build Tool:** Vite
*   **Authentication:** Google OAuth 2.0
*   **API:** Google Drive API v3

## Architecture

The application follows a component-based architecture. The main `App.tsx` component manages the application state, including user authentication, video list, and video player status. The `googleDriveService.ts` module encapsulates the logic for interacting with the Google Drive API. Components are organized into a `components` directory and are responsible for rendering specific parts of the UI.

# Building and Running

**Prerequisites:**

*   Node.js
*   `GEMINI_API_KEY` and `GOOGLE_CLIENT_ID` set in a `.env.local` file.

**Commands:**

*   **Install dependencies:** `npm install`
*   **Run the development server:** `npm run dev`
*   **Build for production:** `npm run build`
*   **Preview the production build:** `npm run preview`

# Development Conventions

*   **Styling:** The project uses Tailwind CSS for styling. Class names are directly embedded in the JSX of the components.
*   **Typing:** The project uses TypeScript for static typing. Type definitions for Google Drive API responses and other objects are located in `types.ts`.
*   **Linting and Formatting:** There are no explicit linting or formatting configurations in the provided files. It is recommended to use a tool like Prettier or ESLint to maintain a consistent code style.
*   **State Management:** The application uses React's built-in state management (`useState`, `useEffect`, `useCallback`) to manage component-level and application-level state.
