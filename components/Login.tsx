import React from 'react';
import Loader from './Loader';

interface LoginProps {
  onLogin: () => void;
  isLoading: boolean;
}

const GoogleIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C41.38,36.128,44,30.638,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
);

const Login: React.FC<LoginProps> = ({ onLogin, isLoading }) => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
      <div className="bg-gray-800/50 p-8 sm:p-12 rounded-2xl shadow-2xl max-w-lg mx-auto backdrop-blur-lg border border-gray-700">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Stream Your Google Drive Videos</h2>
        <p className="text-gray-400 mb-8 text-lg">
          Securely connect your Google account to watch your videos instantly, without downloads and in original quality.
        </p>
        <button
          onClick={onLogin}
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center px-6 py-3 bg-white text-gray-800 font-bold rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-wait transform hover:scale-105"
        >
          {isLoading ? (
            <>
              <Loader /> <span className="ml-3">Initializing...</span>
            </>
          ) : (
            <>
              <GoogleIcon />
              Sign In with Google
            </>
          )}
        </button>
        <p className="text-xs text-gray-500 mt-6">
          This app requests read-only access to your Google Drive files to display your videos. We do not store your files or personal information.
        </p>
      </div>
    </div>
  );
};

export default Login;
