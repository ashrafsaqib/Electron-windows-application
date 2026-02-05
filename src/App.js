import React, { useState } from 'react';
import './App.css';
import Home from './components/Home';
import Settings from './components/Settings';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  return (
    <div className="App">
      <nav className="navbar">
        <div className="navbar-brand">
          <h1 className="app-title">📱 My App</h1>
        </div>
        <ul className="navbar-menu">
          <li>
            <button 
              className={`nav-button ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentPage('home')}
            >
              🏠 Home
            </button>
          </li>
          <li>
            <button 
              className={`nav-button ${currentPage === 'settings' ? 'active' : ''}`}
              onClick={() => setCurrentPage('settings')}
            >
              ⚙️ Settings
            </button>
          </li>
        </ul>
      </nav>

      <main className="main-content">
        {currentPage === 'home' ? (
          <Home />
        ) : (
          <Settings />
        )}
      </main>
    </div>
  );
}

export default App;
