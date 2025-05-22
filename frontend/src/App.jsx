// Updated App.jsx with the popup dialog removed

import { useState, useEffect } from 'react'; // React removed
import { 
  Box, 
  Typography, 
  CssBaseline, 
  Drawer, 
  Toolbar, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  ListItemButton,
  Divider, 
  LinearProgress,
  Avatar,
  Chip,
  CircularProgress
} from '@mui/material';

// Material UI Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Import views
import DashboardView from './views/DashboardView';
import WriteYamlView from './views/WriteYamlView';
import LoaderView from './views/LoaderView';
import UnloadView from './views/UnloadView';
import ReadYamlView from './views/ReadYamlView';
import ReaderView from './views/ReaderView';
import MigrateView from './views/MigrateView';
import SettingsView from './views/SettingsView';

// Import common components
import Notifications from './components/common/Notifications';

// Import hooks from contexts
import { useAppContext } from './context/AppContext';

// Define the drawer width
const drawerWidth = 280;

// Main NoSQLBench Flow Application
function App() {
  const { 
    currentWorkflow,
    isBackendConnected,
    addNotification 
  } = useAppContext();
  
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeStep, setActiveStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate progress percentage based on current workflow or activeStep
  const progress = currentWorkflow 
    ? currentWorkflow.progress 
    : Math.min(Math.round((activeStep / 6) * 100), 100);

  // Sidebar navigation items
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <DashboardIcon />, step: 0 },
    { id: 'writeYaml', name: '1. Write YAML Generator', icon: <DescriptionIcon />, step: 1 },
    { id: 'loader', name: '2. NB5 Loader', icon: <CloudUploadIcon />, step: 2 },
    { id: 'unload', name: '3. DSBulk Unload', icon: <CloudDownloadIcon />, step: 3 },
    { id: 'readYaml', name: '4. Read YAML Generator', icon: <VisibilityIcon />, step: 4 },
    { id: 'reader', name: '5. NB5 Reader', icon: <AutoStoriesIcon />, step: 5 },
    { id: 'migrate', name: '6. CDM Migration', icon: <CompareArrowsIcon />, step: 6 },
    { id: 'settings', name: 'Settings', icon: <SettingsIcon /> }
  ];

  // Add a loading state to simulate initialization
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  // Check backend connection when component mounts
  useEffect(() => {
    if (!isBackendConnected && !isLoading) {
      addNotification({
        type: 'warning',
        title: 'Backend Not Connected',
        message: 'Unable to connect to the backend server. Some features may not work.',
        persistent: true
      });
    }
  }, [isBackendConnected, isLoading, addNotification]);

  // Handle page navigation
  const handleNavigate = (pageId) => {
    // If trying to navigate to a workflow step without a workflow, just go to dashboard
    if (pageId !== 'dashboard' && pageId !== 'settings' && !currentWorkflow) {
      setCurrentPage('dashboard');
      
      // Optionally show a toast notification instead of a popup
      addNotification({
        type: 'info',
        title: 'No Active Workflow',
        message: 'Please start or select a workflow from the dashboard first.',
        duration: 4000
      });
      
      return;
    }
    
    setCurrentPage(pageId);
    
    // Update activeStep based on page
    const item = navItems.find(item => item.id === pageId);
    if (item && item.step !== undefined) {
      setActiveStep(item.step);
    }
  };

  // If app is in loading state, show a loading screen
  if (isLoading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          NoSQLBench Flow
        </Typography>
        <CircularProgress size={48} sx={{ mb: 3 }} />
        <Typography variant="body1" color="text.secondary">
          Initializing application...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
      {/* Display notifications */}
      <Notifications />
      
      {/* Sidebar / Navigation Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: drawerWidth, 
            boxSizing: 'border-box',
            bgcolor: 'primary.dark',
            color: 'white'
          },
        }}
      >
        <Toolbar sx={{ bgcolor: 'primary.dark' }}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            NoSQLBench Flow
          </Typography>
        </Toolbar>
        
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2">
              Progress: {progress}%
            </Typography>
            {currentWorkflow && (
              <Chip 
                label={currentWorkflow.status} 
                size="small"
                color={currentWorkflow.status === 'completed' ? 'success' : 'primary'}
              />
            )}
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
        </Box>
        
        <List>
          {navItems.map((item) => (
            item.id === 'settings' ? (
              <React.Fragment key={item.id}>
                <Divider sx={{ my: 2, bgcolor: 'rgba(255,255,255,0.12)' }} />
                <ListItem disablePadding>
                  <ListItemButton 
                    selected={currentPage === item.id}
                    onClick={() => handleNavigate(item.id)}
                    sx={{ 
                      '&.Mui-selected': { 
                        bgcolor: 'primary.main',
                      },
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.08)',
                      }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: 'white' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.name} />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            ) : (
              <ListItem key={item.id} disablePadding>
                <ListItemButton 
                  selected={currentPage === item.id}
                  onClick={() => handleNavigate(item.id)}
                  sx={{ 
                    '&.Mui-selected': { 
                      bgcolor: 'primary.main',
                    },
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.08)',
                    }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'white' }}>
                    {item.step !== undefined && activeStep > item.step ? (
                      <CheckCircleIcon color="success" />
                    ) : item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.name} />
                </ListItemButton>
              </ListItem>
            )
          ))}
        </List>
        
        <Box sx={{ mt: 'auto', p: 2, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Avatar sx={{ width: 32, height: 32, mr: 1.5 }}>A</Avatar>
            <Box>
              <Typography variant="body2">Admin User</Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>admin@example.com</Typography>
            </Box>
          </Box>
        </Box>
      </Drawer>
      
      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default', overflow: 'auto' }}>
        <Toolbar sx={{ visibility: 'hidden' }} /> {/* Add space for the toolbar */}
        {currentPage === 'dashboard' && <DashboardView onStart={() => handleNavigate('writeYaml')} />}
        {currentPage === 'writeYaml' && <WriteYamlView onNext={() => handleNavigate('loader')} />}
        {currentPage === 'loader' && <LoaderView onNext={() => handleNavigate('unload')} />}
        {currentPage === 'unload' && <UnloadView onNext={() => handleNavigate('readYaml')} />}
        {currentPage === 'readYaml' && <ReadYamlView onNext={() => handleNavigate('reader')} />}
        {currentPage === 'reader' && <ReaderView onNext={() => handleNavigate('migrate')} />}
        {currentPage === 'migrate' && <MigrateView onNext={() => handleNavigate('dashboard')} />}
        {currentPage === 'settings' && <SettingsView />}
      </Box>
    </Box>
  );
}

export default App;