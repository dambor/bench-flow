import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Paper,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Alert,
  Divider
} from '@mui/material';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import TimelineIcon from '@mui/icons-material/Timeline';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';

import { useAppContext } from '../context/AppContext';
import { useSchemaContext } from '../context/SchemaContext';
import { useDSBulkContext } from '../context/DSBulkContext';
import { useNB5Context } from '../context/NB5Context';
import { healthApi } from '../services/api';

// Dashboard View
const DashboardView = ({ onStart }) => {
  const { isBackendConnected, currentWorkflow } = useAppContext();
  const { schemaData } = useSchemaContext();
  const { isValidated: isDSBulkValidated } = useDSBulkContext();
  const { isValidated: isNB5Validated, executions } = useNB5Context();
  
  const [systemStatus, setSystemStatus] = useState({
    isHealthy: false,
    lastChecked: null,
    activeWorkloads: 0
  });
  
  // Check system status on component mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await healthApi.checkHealth();
        setSystemStatus({
          isHealthy: true,
          lastChecked: new Date(),
          activeWorkloads: executions.filter(e => e.is_running).length
        });
      } catch (error) {
        console.error('Health check failed:', error);
        setSystemStatus({
          isHealthy: false,
          lastChecked: new Date(),
          activeWorkloads: 0
        });
      }
    };
    
    checkHealth();
  }, [executions]);
  
  // Workflow items - would come from an API in a real application
  const workflowItems = [
    currentWorkflow ? {
      ...currentWorkflow,
      updatedAt: currentWorkflow.endTime || new Date()
    } : null,
    {
      id: 101,
      name: "User Activity Benchmarks",
      status: "in-progress",
      progress: 65,
      startTime: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 30)
    },
    {
      id: 102,
      name: "Product Catalog Test",
      status: "completed",
      progress: 100,
      startTime: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
      updatedAt: new Date(Date.now() - 1000 * 60 * 120)
    }
  ].filter(Boolean);
  
  return (
    <Container maxWidth="xl">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Welcome to NoSQLBench Flow
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          size="large" 
          startIcon={<PlayCircleFilledIcon />}
          onClick={onStart}
        >
          Start New Workflow
        </Button>
      </Box>
      
      {!isBackendConnected && (
        <Alert 
          severity="warning" 
          variant="outlined"
          sx={{ mb: 3 }}
        >
          Unable to connect to the backend server. Some features may not work properly.
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Recent Workflows */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Recent Workflows" />
            <CardContent>
              <Stack spacing={2}>
                {workflowItems.map((workflow) => (
                  <WorkflowItem 
                    key={workflow.id}
                    name={workflow.name} 
                    status={workflow.status} 
                    progress={workflow.progress}
                    updatedAt={timeSince(workflow.updatedAt)}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Status" />
            <CardContent>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Active Workloads</TableCell>
                      <TableCell align="right">{systemStatus.activeWorkloads}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Available Tables</TableCell>
                      <TableCell align="right">{schemaData ? Object.keys(schemaData.tables || {}).length : 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>DSBulk Status</TableCell>
                      <TableCell align="right">
                        {isDSBulkValidated ? (
                          <Chip 
                            size="small" 
                            icon={<CheckCircleIcon />} 
                            label="Available" 
                            color="success" 
                          />
                        ) : (
                          <Chip 
                            size="small" 
                            icon={<WarningIcon />} 
                            label="Not Found" 
                            color="warning" 
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>NB5 Status</TableCell>
                      <TableCell align="right">
                        {isNB5Validated ? (
                          <Chip 
                            size="small" 
                            icon={<CheckCircleIcon />} 
                            label="Available" 
                            color="success" 
                          />
                        ) : (
                          <Chip 
                            size="small" 
                            icon={<WarningIcon />} 
                            label="Not Found" 
                            color="warning" 
                          />
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>System Status</TableCell>
                      <TableCell align="right" sx={{ color: systemStatus.isHealthy ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                        {systemStatus.isHealthy ? 'Healthy' : 'Unavailable'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Quick Stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <MemoryIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Executions
                  </Typography>
                </Box>
                <Typography variant="h4" component="div" gutterBottom>
                  {executions.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total NB5 executions
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <StorageIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Tables
                  </Typography>
                </Box>
                <Typography variant="h4" component="div" gutterBottom>
                  {schemaData ? Object.keys(schemaData.tables || {}).length : 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Schema tables parsed
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TimelineIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Workloads
                  </Typography>
                </Box>
                <Typography variant="h4" component="div" gutterBottom>
                  {workflowItems.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Recent workloads
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SystemUpdateAltIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6" component="div">
                    Backend
                  </Typography>
                </Box>
                <Typography 
                  variant="h6" 
                  component="div" 
                  gutterBottom
                  sx={{ 
                    color: isBackendConnected ? 'success.main' : 'error.main',
                    fontWeight: 'bold'
                  }}
                >
                  {isBackendConnected ? 'Connected' : 'Disconnected'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  API connection status
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
        
        {/* Workflow Steps */}
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Workflow Steps" />
            <CardContent>
              <Box sx={{ display: 'flex', overflow: 'auto', py: 2, px: 1 }}>
                <WorkflowStep 
                  number={1}
                  title="Generate Write YAML"
                  status="completed"
                  onClick={onStart}
                />
                <WorkflowConnector status="completed" />
                <WorkflowStep 
                  number={2}
                  title="Run NB5 Loader"
                  status="completed"
                />
                <WorkflowConnector status="completed" />
                <WorkflowStep 
                  number={3}
                  title="DSBulk Unload"
                  status="active"
                />
                <WorkflowConnector status="pending" />
                <WorkflowStep 
                  number={4}
                  title="Generate Read YAML"
                  status="pending"
                />
                <WorkflowConnector status="pending" />
                <WorkflowStep 
                  number={5}
                  title="Run NB5 Reader"
                  status="pending"
                />
                <WorkflowConnector status="pending" />
                <WorkflowStep 
                  number={6}
                  title="CDM Migration"
                  status="pending"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

// Helper function to display relative time
function timeSince(date) {
  if (!date) return 'Unknown time';
  
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) return interval + ' years ago';
  if (interval === 1) return '1 year ago';
  
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) return interval + ' months ago';
  if (interval === 1) return '1 month ago';
  
  interval = Math.floor(seconds / 86400);
  if (interval > 1) return interval + ' days ago';
  if (interval === 1) return '1 day ago';
  
  interval = Math.floor(seconds / 3600);
  if (interval > 1) return interval + ' hours ago';
  if (interval === 1) return '1 hour ago';
  
  interval = Math.floor(seconds / 60);
  if (interval > 1) return interval + ' minutes ago';
  if (interval === 1) return '1 minute ago';
  
  return 'Just now';
}

// Workflow Item Component
function WorkflowItem({ name, status, progress, updatedAt }) {
  const statusConfig = {
    'completed': { color: 'success', label: 'Completed' },
    'in-progress': { color: 'info', label: 'In Progress' },
    'failed': { color: 'error', label: 'Failed' }
  };
  
  const config = statusConfig[status];
  
  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        border: '1px solid', 
        borderColor: 'divider',
        borderRadius: 1
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="subtitle1">{name}</Typography>
          <Typography variant="body2" color="text.secondary">{updatedAt}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 100 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              color={config.color} 
            />
          </Box>
          <Chip 
            label={config.label} 
            color={config.color} 
            size="small" 
          />
        </Box>
      </Box>
    </Paper>
  );
}

// Workflow Step Component
function WorkflowStep({ number, title, status, onClick }) {
  const statusConfig = {
    completed: {
      bgcolor: 'success.main',
      color: 'white',
      icon: <CheckCircleIcon />
    },
    active: {
      bgcolor: 'info.main',
      color: 'white',
      icon: number
    },
    pending: {
      bgcolor: 'grey.300',
      color: 'text.secondary',
      icon: number
    }
  };
  
  const config = statusConfig[status];
  
  return (
    <Paper 
      elevation={status === 'pending' ? 0 : 1}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        p: 2,
        minWidth: 120,
        borderRadius: 1,
        cursor: 'pointer',
        opacity: status === 'pending' ? 0.7 : 1,
        '&:hover': {
          boxShadow: 2
        }
      }}
      onClick={onClick}
    >
      <Box 
        sx={{ 
          bgcolor: config.bgcolor, 
          color: config.color, 
          mb: 1,
          width: 36,
          height: 36,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {typeof config.icon === 'number' ? config.icon : config.icon}
      </Box>
      <Typography 
        variant="body2" 
        align="center" 
        sx={{ fontWeight: status === 'pending' ? 'normal' : 'medium' }}
      >
        {title}
      </Typography>
    </Paper>
  );
}

// Workflow Connector Component
function WorkflowConnector({ status }) {
  const statusColors = {
    completed: 'success.main',
    active: 'info.main',
    pending: 'grey.300'
  };
  
  return (
    <Box sx={{ 
      display: 'flex', 
      alignItems: 'center', 
      px: 1,
      minWidth: 30
    }}>
      <Box sx={{ 
        height: 2, 
        width: '100%', 
        bgcolor: statusColors[status] 
      }} />
    </Box>
  );
}

export default DashboardView;