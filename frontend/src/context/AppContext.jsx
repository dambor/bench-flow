import React, { createContext, useContext, useState, useEffect } from 'react';
import { healthApi } from '../services/api';

// Create the context
const AppContext = createContext();

// Create a hook to use the context
export const useAppContext = () => useContext(AppContext);

// Provider component
export const AppProvider = ({ children }) => {
  // App state
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  
  // Check if the backend is available
  useEffect(() => {
    const checkBackendConnection = async () => {
      try {
        await healthApi.checkHealth();
        setIsBackendConnected(true);
      } catch (error) {
        console.error('Backend connection check failed:', error);
        setIsBackendConnected(false);
      }
    };
    
    // Initial check
    checkBackendConnection();
    
    // Set up interval for periodic checks
    const interval = setInterval(checkBackendConnection, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Add a notification
  const addNotification = (notification) => {
    const id = Date.now();
    const newNotification = {
      id,
      timestamp: new Date(),
      ...notification
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Auto-remove notifications after a delay if they're not persistent
    if (!notification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
    
    return id;
  };
  
  // Remove a notification
  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };
  
  // Set an error and add an error notification
  const setError = (error) => {
    setLastError(error);
    
    // Add an error notification
    addNotification({
      type: 'error',
      title: 'Error',
      message: error.message || 'An unknown error occurred',
      duration: 10000,
    });
  };
  
  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };
  
  // Start a new workflow
  const startWorkflow = (name, description) => {
    setCurrentWorkflow({
      id: Date.now(),
      name: name || 'New Workflow',
      description: description || 'Started on ' + new Date().toLocaleString(),
      startTime: new Date(),
      steps: [],
      status: 'in-progress',
      progress: 0,
    });
  };
  
  // Update workflow status
  const updateWorkflow = (updates) => {
    if (!currentWorkflow) return;
    
    setCurrentWorkflow(prev => ({
      ...prev,
      ...updates,
      steps: [...(prev.steps || []), ...(updates.steps || [])],
    }));
  };
  
  // Complete a workflow
  const completeWorkflow = (status = 'completed') => {
    if (!currentWorkflow) return;
    
    setCurrentWorkflow(prev => ({
      ...prev,
      endTime: new Date(),
      status,
      progress: status === 'completed' ? 100 : prev.progress,
    }));
  };
  
  // Value object that will be provided to consumers
  const contextValue = {
    isBackendConnected,
    lastError,
    notifications,
    currentWorkflow,
    addNotification,
    removeNotification,
    setError,
    clearNotifications,
    startWorkflow,
    updateWorkflow,
    completeWorkflow,
  };
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;