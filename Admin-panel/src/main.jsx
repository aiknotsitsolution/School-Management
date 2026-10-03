import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { CelebrationProvider } from './components/celebration/CelebrationProvider.jsx'
import { ThemeProvider } from './hooks/useThemeMode.jsx'
import { store } from './store'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <ErrorBoundary>
          <CelebrationProvider>
            <App />
          </CelebrationProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
)