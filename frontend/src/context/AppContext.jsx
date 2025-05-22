import { createContext, useContext, useState, useEffect } from 'react'; // React removed
import { healthApi } from '../services/api';

// Create the context
const AppContext = createContext();

// Create a hook to use the context
export const useAppContext = () => useContext(AppContext);

// Provider component
export const AppProvider = ({ children }) => {
  // App state
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  // const [lastError, setLastError] = useState(null); // lastError was unused
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
  
  // Load current workflow from localStorage if available
  useEffect(() => {
    const savedWorkflow = localStorage.getItem('nosqlbench_current_workflow');
    if (savedWorkflow) {
      try {
        const parsedWorkflow = JSON.parse(savedWorkflow);
        // Only restore if it's not completed and not too old (24 hours)
        const workflowAge = new Date() - new Date(parsedWorkflow.startTime);
        const isRecent = workflowAge < 24 * 60 * 60 * 1000; // 24 hours
        
        if (parsedWorkflow.status !== 'completed' && isRecent) {
          setCurrentWorkflow(parsedWorkflow);
        }
      } catch (error) {
        console.error('Error loading saved workflow:', error);
      }
    }
  }, []);
  
  // Save current workflow to localStorage when it changes
  useEffect(() => {
    if (currentWorkflow) {
      localStorage.setItem('nosqlbench_current_workflow', JSON.stringify(currentWorkflow));
    }
  }, [currentWorkflow]);
  
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
    // setLastError(error); // lastError was unused
    
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
  
  // Helper function to update the workflows list in localStorage
  const updateWorkflowsInStorage = (workflow) => {
    const savedWorkflows = localStorage.getItem('nosqlbench_workflows');
    let workflows = [];
    
    if (savedWorkflows) {
      try {
        workflows = JSON.parse(savedWorkflows);
      } catch (error) {
        console.error('Error parsing saved workflows:', error);
      }
    }
    
    // Check if the workflow already exists in the list
    const existingIndex = workflows.findIndex(w => w.id === workflow.id);
    
    if (existingIndex >= 0) {
      // Update existing workflow
      workflows[existingIndex] = {
        ...workflow,
        updatedAt: new Date()
      };
    } else {
      // Add new workflow to the list, ensuring no duplicates
      // First, remove any possible duplicates with the same ID
      const filteredWorkflows = workflows.filter(w => w.id !== workflow.id);
      
      // Then add the new workflow at the beginning
      filteredWorkflows.unshift({
        ...workflow,
        updatedAt: new Date()
      });
      
      workflows = filteredWorkflows;
    }
    
    // Save updated list
    localStorage.setItem('nosqlbench_workflows', JSON.stringify(workflows));
  };
  
  // Start a new workflow
  const startWorkflow = (name, description) => {
    // Generate a unique ID for the new workflow
    const newWorkflowId = Date.now();
    
    const newWorkflow = {
      id: newWorkflowId,
      name: name || 'New Workflow',
      description: description || 'Started on ' + new Date().toLocaleString(),
      startTime: new Date(),
      steps: [],
      status: 'in-progress',
      progress: 0,
    };
    
    // Set as current workflow
    setCurrentWorkflow(newWorkflow);
    
    // Save to localStorage as current workflow
    localStorage.setItem('nosqlbench_current_workflow', JSON.stringify(newWorkflow));
    
    // Get existing workflows from localStorage
    const savedWorkflows = localStorage.getItem('nosqlbench_workflows');
    let workflows = [];
    
    if (savedWorkflows) {
      try {
        workflows = JSON.parse(savedWorkflows);
      } catch (error) {
        console.error('Error parsing saved workflows:', error);
      }
    }
    
    // Add the new workflow to the beginning of the list (without replacing existing ones)
    workflows.unshift({
      ...newWorkflow,
      updatedAt: new Date()
    });
    
    // Save the updated workflows list
    localStorage.setItem('nosqlbench_workflows', JSON.stringify(workflows));
    
    // Add a notification about the new workflow
    addNotification({
      type: 'success',
      title: 'Workflow Started',
      message: `New workflow "${name}" has been created`,
      duration: 2000,
    });
    
    return newWorkflow;
  };
  
  // Resume an existing workflow
  const resumeWorkflow = (workflow) => {
    if (!workflow) return null;
    
    // Create a resumed version of the workflow
    const resumedWorkflow = {
      ...workflow,
      resumedAt: new Date(),
      lastAccessed: new Date(),
      // Keep the original workflow status but mark it as resumed
      status: workflow.status === 'completed' ? 'completed' : 'in-progress',
    };
    
    // Set as current workflow
    setCurrentWorkflow(resumedWorkflow);
    
    // Save to localStorage
    localStorage.setItem('nosqlbench_current_workflow', JSON.stringify(resumedWorkflow));
    
    // Add a notification about resuming the workflow
    addNotification({
      type: 'info',
      title: 'Workflow Resumed',
      message: `Resumed workflow: ${workflow.name}`,
      duration: 2000,
    });
    
    return resumedWorkflow;
  };
  
  // Update workflow status
  const updateWorkflow = (updates) => {
    if (!currentWorkflow) return;
    
    const updatedWorkflow = {
      ...currentWorkflow,
      ...updates,
      steps: [...(currentWorkflow.steps || []), ...(updates.steps || [])],
    };
    
    setCurrentWorkflow(updatedWorkflow);
    
    // Save to localStorage
    localStorage.setItem('nosqlbench_current_workflow', JSON.stringify(updatedWorkflow));
    
    // Update the workflow list in localStorage
    updateWorkflowsInStorage(updatedWorkflow);
  };
  
  // Complete a workflow
  const completeWorkflow = (status = 'completed') => {
    if (!currentWorkflow) return;
    
    const completedWorkflow = {
      ...currentWorkflow,
      endTime: new Date(),
      status,
      progress: status === 'completed' ? 100 : currentWorkflow.progress,
    };
    
    setCurrentWorkflow(completedWorkflow);
    
    // Save to localStorage
    localStorage.setItem('nosqlbench_current_workflow', JSON.stringify(completedWorkflow));
    
    // Update the workflow list in localStorage
    updateWorkflowsInStorage(completedWorkflow);
  };
  
  // Delete a workflow
  const deleteWorkflow = (workflowId) => {
    // If it's the current workflow, clear it
    if (currentWorkflow && currentWorkflow.id === workflowId) {
      setCurrentWorkflow(null);
      localStorage.removeItem('nosqlbench_current_workflow');
    }
    
    // Remove from the workflows list in localStorage
    const savedWorkflows = localStorage.getItem('nosqlbench_workflows');
    if (savedWorkflows) {
      try {
        const parsedWorkflows = JSON.parse(savedWorkflows);
        const updatedWorkflows = parsedWorkflows.filter(w => w.id !== workflowId);
        localStorage.setItem('nosqlbench_workflows', JSON.stringify(updatedWorkflows));
        
        // Add a notification
        addNotification({
          type: 'success',
          title: 'Workflow Deleted',
          message: 'The workflow has been deleted successfully.',
          duration: 2000,
        });
      } catch (error) {
        console.error('Error updating workflows in storage:', error);
      }
    }
  };
  
  // Value object that will be provided to consumers
  const contextValue = {
    isBackendConnected,
    // lastError, // lastError was unused
    notifications,
    currentWorkflow,
    addNotification,
    removeNotification,
    setError,
    clearNotifications,
    startWorkflow,
    resumeWorkflow,
    updateWorkflow,
    completeWorkflow,
    deleteWorkflow,
  };
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;