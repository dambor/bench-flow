import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
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
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip
} from '@mui/material';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import MemoryIcon from '@mui/icons-material/Memory';
import TimelineIcon from '@mui/icons-material/Timeline';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';
import AddIcon from '@mui/icons-material/Add';
import ReplayIcon from '@mui/icons-material/Replay';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { useAppContext } from '../context/AppContext';
import { useSchemaContext } from '../context/SchemaContext';
import { useDSBulkContext } from '../context/DSBulkContext';
import { useNB5Context } from '../context/NB5Context';
import { healthApi } from '../services/api';

// Dashboard View
const DashboardView = ({ onStart }) => {
  const { 
    isBackendConnected, 
    currentWorkflow, 
    startWorkflow, 
    resumeWorkflow  // Make sure this exists in your AppContext
  } = useAppContext();
  const { schemaData, clearSchema } = useSchemaContext();
  const { isValidated: isDSBulkValidated } = useDSBulkContext();
  const { isValidated: isNB5Validated, executions } = useNB5Context();
  
  const [systemStatus, setSystemStatus] = useState({
    isHealthy: false,
    lastChecked: null,
    activeWorkloads: 0
  });
  
  const [openNewFlowDialog, setOpenNewFlowDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDescription, setNewFlowDescription] = useState('');
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [activeMenuWorkflowId, setActiveMenuWorkflowId] = useState(null);
  
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
  
  // Initialize workflows from localStorage on component mount
  useEffect(() => {
    const savedWorkflows = localStorage.getItem('nosqlbench_workflows');
    if (savedWorkflows) {
      try {
        const parsedWorkflows = JSON.parse(savedWorkflows);
        
        // Remove duplicates by ID before setting the state
        const uniqueWorkflows = [];
        const seenIds = new Set();
        
        parsedWorkflows.forEach(workflow => {
          if (!seenIds.has(workflow.id)) {
            seenIds.add(workflow.id);
            uniqueWorkflows.push(workflow);
          }
        });
        
        setWorkflows(uniqueWorkflows);
      } catch (error) {
        console.error('Error loading saved workflows:', error);
      }
    } else {
      // Set initial mock workflows if none exist
      const initialWorkflows = [
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
      ];
      
      setWorkflows(initialWorkflows);
      localStorage.setItem('nosqlbench_workflows', JSON.stringify(initialWorkflows));
    }
  }, []);
  
  // Update workflows in localStorage when they change
  useEffect(() => {
    if (workflows.length > 0) {
      localStorage.setItem('nosqlbench_workflows', JSON.stringify(workflows));
    }
  }, [workflows]);
  
  // Add current workflow to workflows list when it changes
  useEffect(() => {
    if (currentWorkflow) {
      setWorkflows(prevWorkflows => {
        // Check if the workflow already exists in the list
        const existingIndex = prevWorkflows.findIndex(w => w.id === currentWorkflow.id);
        
        if (existingIndex >= 0) {
          // Update existing workflow
          const updatedWorkflows = [...prevWorkflows];
          updatedWorkflows[existingIndex] = {
            ...currentWorkflow,
            updatedAt: new Date()
          };
          return updatedWorkflows;
        } else {
          // Add new workflow to the list
          return [
            {
              ...currentWorkflow,
              updatedAt: new Date()
            },
            ...prevWorkflows
          ];
        }
      });
    }
  }, [currentWorkflow]);
  
  // Handle opening the new flow dialog
  const handleOpenNewFlowDialog = () => {
    setNewFlowName('');
    setNewFlowDescription('');
    setOpenNewFlowDialog(true);
  };
  
  // Handle closing the new flow dialog
  const handleCloseNewFlowDialog = () => {
    setOpenNewFlowDialog(false);
  };
  
  // Handle opening the menu for a workflow
  const handleOpenMenu = (event, workflowId) => {
    setMenuAnchorEl(event.currentTarget);
    setActiveMenuWorkflowId(workflowId);
  };
  
  // Handle closing the menu
  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setActiveMenuWorkflowId(null);
  };
  
  // Handle starting a new flow
  const handleStartNewFlow = () => {
    // Use default name if none provided
    const flowName = newFlowName.trim() || 'New Workflow';
    const flowDescription = newFlowDescription.trim() || `Started on ${new Date().toLocaleString()}`;
    
    // Start a brand new workflow
    const newWorkflow = startWorkflow(flowName, flowDescription);
    
    // Clear any existing schema data
    clearSchema();
    
    // Close the dialog
    handleCloseNewFlowDialog();
    
    // Navigate to the first step
    if (onStart) {
      onStart();
    }
  };
  
  // Handle resuming a workflow
  const handleResumeWorkflow = (workflow) => {
    // Close the menu if it's open
    handleCloseMenu();
    
    // Find the workflow by id
    const workflowToResume = workflows.find(w => w.id === workflow.id);
    
    if (workflowToResume) {
      // Resume the workflow
      resumeWorkflow(workflowToResume);
      
      // Navigate to the appropriate step based on progress
      if (onStart) {
        onStart();
      }
    }
  };
  
  // Handle opening delete confirmation dialog
  const handleOpenDeleteDialog = (workflow) => {
    // Close the menu if it's open
    handleCloseMenu();
    
    // Set the selected workflow for deletion
    setSelectedWorkflow(workflow);
    setOpenDeleteDialog(true);
  };
  
  // Handle closing delete confirmation dialog
  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSelectedWorkflow(null);
  };
  
  // Handle deleting a workflow
  const handleDeleteWorkflow = () => {
    if (!selectedWorkflow) return;
    
    // Remove the workflow from the list
    const updatedWorkflows = workflows.filter(w => w.id !== selectedWorkflow.id);
    setWorkflows(updatedWorkflows);
    
    // Update localStorage
    localStorage.setItem('nosqlbench_workflows', JSON.stringify(updatedWorkflows));
    
    // Close the dialog
    handleCloseDeleteDialog();
  };
  
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
          onClick={handleOpenNewFlowDialog}
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
            <CardHeader 
              title="Recent Workflows" 
              action={
                <Button 
                  size="small" 
                  variant="outlined" 
                  startIcon={<PlayCircleFilledIcon />}
                  onClick={handleOpenNewFlowDialog}
                >
                  New Workflow
                </Button>
              }
            />
            <CardContent>
              {workflows.length > 0 ? (
                <Stack spacing={2}>
                  {workflows.map((workflow) => (
                    <WorkflowItem 
                      key={workflow.id}
                      workflow={workflow}
                      onMenuOpen={(e) => handleOpenMenu(e, workflow.id)}
                      onResume={() => handleResumeWorkflow(workflow)}
                      onDelete={() => handleOpenDeleteDialog(workflow)}
                    />
                  ))}
                </Stack>
              ) : (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No workflows yet. Start a new workflow to get started.
                  </Typography>
                  <Button 
                    variant="contained" 
                    startIcon={<AddIcon />}
                    onClick={handleOpenNewFlowDialog}
                    sx={{ mt: 2 }}
                  >
                    Start New Workflow
                  </Button>
                </Box>
              )}
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
                  {workflows.length}
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
                  onClick={handleOpenNewFlowDialog}
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

      {/* New Workflow Dialog */}
      <Dialog open={openNewFlowDialog} onClose={handleCloseNewFlowDialog}>
        <DialogTitle>Start New Workflow</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please provide a name and description for your new workflow. This will create a brand new workflow and clear any existing data.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="name"
            label="Workflow Name"
            type="text"
            fullWidth
            variant="outlined"
            value={newFlowName}
            onChange={(e) => setNewFlowName(e.target.value)}
            placeholder="My NoSQLBench Workflow"
            sx={{ mt: 2 }}
          />
          <TextField
            margin="dense"
            id="description"
            label="Description (Optional)"
            type="text"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={newFlowDescription}
            onChange={(e) => setNewFlowDescription(e.target.value)}
            placeholder="Brief description of this workflow"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNewFlowDialog}>Cancel</Button>
          <Button onClick={handleStartNewFlow} variant="contained" startIcon={<AddIcon />}>
            Create & Start
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Workflow Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Delete Workflow</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the workflow "{selectedWorkflow?.name}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleDeleteWorkflow} variant="contained" color="error" startIcon={<DeleteIcon />}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Workflow Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
      >
        <MenuItem onClick={() => {
          const workflow = workflows.find(w => w.id === activeMenuWorkflowId);
          if (workflow) handleResumeWorkflow(workflow);
        }}>
          <ListItemIcon>
            <ReplayIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Resume Workflow</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          const workflow = workflows.find(w => w.id === activeMenuWorkflowId);
          if (workflow) handleOpenDeleteDialog(workflow);
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Workflow</ListItemText>
        </MenuItem>
      </Menu>
    </Container>
  );
};

// Helper function to display relative time
function timeSince(date) {
  if (!date) return 'Unknown time';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  const seconds = Math.floor((new Date() - dateObj) / 1000);
  
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
function WorkflowItem({ workflow, onMenuOpen, onResume, onDelete }) {
  const { name, status, progress, updatedAt } = workflow;
  
  const statusConfig = {
    'completed': { color: 'success', label: 'Completed' },
    'in-progress': { color: 'info', label: 'In Progress' },
    'failed': { color: 'error', label: 'Failed' }
  };
  
  const config = statusConfig[status] || statusConfig['in-progress'];
  
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
          <Typography variant="body2" color="text.secondary">{timeSince(updatedAt)}</Typography>
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
          <Box sx={{ ml: 1, display: 'flex' }}>
            <Tooltip title="Resume Workflow">
              <IconButton 
                size="small" 
                onClick={onResume}
                color="primary"
              >
                <ReplayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Workflow">
              <IconButton 
                size="small" 
                onClick={onDelete}
                color="error"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton 
              size="small" 
              onClick={onMenuOpen}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
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