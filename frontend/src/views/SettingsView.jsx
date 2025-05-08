import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardHeader,
  CardContent,
  Divider,
  TextField,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Paper,
  Tab,
  Tabs
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import FolderIcon from '@mui/icons-material/Folder';
import StorageIcon from '@mui/icons-material/Storage';
import WifiIcon from '@mui/icons-material/Wifi';

import { useDSBulkContext } from '../context/DSBulkContext';
import { useNB5Context } from '../context/NB5Context';
import { useAppContext } from '../context/AppContext';

const SettingsView = () => {
  const { validateDSBulk, dsbulkPath, isValidated: isDSBulkValidated } = useDSBulkContext();
  const { validateNB5, nb5Path, isValidated: isNB5Validated } = useNB5Context();
  const { isBackendConnected, clearNotifications } = useAppContext();
  
  const [activeTab, setActiveTab] = useState(0);
  const [settings, setSettings] = useState({
    dsbulkPath: dsbulkPath || '',
    nb5Path: nb5Path || '',
    cassandraHost: 'localhost',
    cassandraPort: '9042',
    keyspace: 'baselines',
    datacenter: 'datacenter1',
    enableNotifications: true,
    darkMode: false,
    autoValidate: true
  });
  
  // Update local settings when context values change
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      dsbulkPath: dsbulkPath || prev.dsbulkPath,
      nb5Path: nb5Path || prev.nb5Path
    }));
  }, [dsbulkPath, nb5Path]);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Handle settings change
  const handleSettingChange = (event) => {
    const { name, value, checked, type } = event.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  // Handle save settings
  const handleSaveSettings = () => {
    // In a real app, this would save to backend and update contexts
    // For this demo, we'll just validate the paths
    validateDSBulk();
    validateNB5();
  };
  
  // Handle validation button click
  const handleValidate = () => {
    validateDSBulk();
    validateNB5();
  };
  
  // Handle clear notifications
  const handleClearNotifications = () => {
    clearNotifications();
  };
  
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Configure application settings for NoSQLBench Flow
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange} 
          aria-label="settings tabs"
        >
          <Tab icon={<SettingsIcon />} iconPosition="start" label="General" id="tab-0" />
          <Tab icon={<StorageIcon />} iconPosition="start" label="Database" id="tab-1" />
          <Tab icon={<FolderIcon />} iconPosition="start" label="Paths" id="tab-2" />
        </Tabs>
      </Box>
      
      {/* General Settings Tab */}
      {activeTab === 0 && (
        <Card variant="outlined">
          <CardHeader title="General Settings" />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.enableNotifications}
                      onChange={handleSettingChange}
                      name="enableNotifications"
                      color="primary"
                    />
                  }
                  label="Enable Notifications"
                />
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Show notifications for application events
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.darkMode}
                      onChange={handleSettingChange}
                      name="darkMode"
                      color="primary"
                    />
                  }
                  label="Dark Mode"
                />
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Toggle dark mode theme (not implemented in this demo)
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.autoValidate}
                      onChange={handleSettingChange}
                      name="autoValidate"
                      color="primary"
                    />
                  }
                  label="Auto-validate JAR Files"
                />
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Automatically validate DSBulk and NB5 paths on startup
                </Typography>
              </Grid>
              
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleClearNotifications}
                  startIcon={<DeleteIcon />}
                >
                  Clear All Notifications
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      
      {/* Database Settings Tab */}
      {activeTab === 1 && (
        <Card variant="outlined">
          <CardHeader title="Database Settings" />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Cassandra Host"
                  name="cassandraHost"
                  value={settings.cassandraHost}
                  onChange={handleSettingChange}
                  margin="normal"
                  helperText="Hostname or IP address of Cassandra server"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Cassandra Port"
                  name="cassandraPort"
                  value={settings.cassandraPort}
                  onChange={handleSettingChange}
                  margin="normal"
                  helperText="Port number for Cassandra connection"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Default Keyspace"
                  name="keyspace"
                  value={settings.keyspace}
                  onChange={handleSettingChange}
                  margin="normal"
                  helperText="Default keyspace to use for operations"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Local Datacenter"
                  name="datacenter"
                  value={settings.datacenter}
                  onChange={handleSettingChange}
                  margin="normal"
                  helperText="Local datacenter name for Cassandra connection"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ mr: 2 }}>
                    Backend Connection Status:
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WifiIcon 
                      color={isBackendConnected ? "success" : "error"} 
                      sx={{ mr: 1 }}
                    />
                    <Typography 
                      variant="body1" 
                      color={isBackendConnected ? "success.main" : "error.main"}
                      fontWeight="bold"
                    >
                      {isBackendConnected ? "Connected" : "Disconnected"}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      
      {/* Paths Settings Tab */}
      {activeTab === 2 && (
        <Card variant="outlined">
          <CardHeader title="JAR File Paths" />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="DSBulk JAR Path"
                  name="dsbulkPath"
                  value={settings.dsbulkPath}
                  onChange={handleSettingChange}
                  margin="normal"
                  helperText="Full path to the DSBulk JAR file"
                />
                
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Typography variant="caption" sx={{ mr: 1 }}>
                    Status:
                  </Typography>
                  {isDSBulkValidated ? (
                    <Alert severity="success" icon={false} sx={{ py: 0, px: 1 }}>
                      DSBulk JAR file is valid
                    </Alert>
                  ) : (
                    <Alert severity="warning" icon={false} sx={{ py: 0, px: 1 }}>
                      DSBulk JAR file not found or invalid
                    </Alert>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="NB5 JAR Path"
                  name="nb5Path"
                  value={settings.nb5Path}
                  onChange={handleSettingChange}
                  margin="normal"
                  helperText="Full path to the NoSQLBench 5 JAR file"
                />
                
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Typography variant="caption" sx={{ mr: 1 }}>
                    Status:
                  </Typography>
                  {isNB5Validated ? (
                    <Alert severity="success" icon={false} sx={{ py: 0, px: 1 }}>
                      NB5 JAR file is valid
                    </Alert>
                  ) : (
                    <Alert severity="warning" icon={false} sx={{ py: 0, px: 1 }}>
                      NB5 JAR file not found or invalid
                    </Alert>
                  )}
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={handleValidate}
                    startIcon={<RefreshIcon />}
                  >
                    Validate JAR Files
                  </Button>
                  
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSaveSettings}
                    startIcon={<SaveIcon />}
                  >
                    Save Settings
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default SettingsView;