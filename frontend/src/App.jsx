import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  CssBaseline, 
  Drawer, 
  AppBar, 
  Toolbar, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  ListItemButton,
  Divider, 
  Container, 
  Grid, 
  Card, 
  CardHeader, 
  CardContent, 
  Button,
  LinearProgress,
  Avatar,
  Paper,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
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
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';

// Define the drawer width
const drawerWidth = 280;

// Main NoSQLBench Flow Application
function NoSQLBenchFlow() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeStep, setActiveStep] = useState(0);

  // Calculate progress percentage
  const totalSteps = 6;
  const progress = Math.min(Math.round((activeStep / totalSteps) * 100), 100);

  // Sidebar navigation items
  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'writeYaml', name: '1. Write YAML Generator', icon: <DescriptionIcon />, step: 1 },
    { id: 'loader', name: '2. NB5 Loader', icon: <CloudUploadIcon />, step: 2 },
    { id: 'unload', name: '3. DSBulk Unload', icon: <CloudDownloadIcon />, step: 3 },
    { id: 'readYaml', name: '4. Read YAML Generator', icon: <VisibilityIcon />, step: 4 },
    { id: 'reader', name: '5. NB5 Reader', icon: <AutoStoriesIcon />, step: 5 },
    { id: 'migrate', name: '6. CDM Migration', icon: <CompareArrowsIcon />, step: 6 },
    { id: 'settings', name: 'Settings', icon: <SettingsIcon /> }
  ];

  // Handle page navigation
  const handleNavigate = (pageId) => {
    setCurrentPage(pageId);
    
    // Update activeStep based on page
    const item = navItems.find(item => item.id === pageId);
    if (item && item.step) {
      setActiveStep(item.step);
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      
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
          <Typography variant="body2" sx={{ mb: 1 }}>
            Progress: {progress}%
          </Typography>
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
                    {item.step && activeStep > item.step ? (
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
      <Box component="main" sx={{ flexGrow: 1, p: 3, bgcolor: 'background.default' }}>
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

// Dashboard View
function DashboardView({ onStart }) {
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
      
      <Grid container spacing={3}>
        {/* Recent Workflows */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Recent Workflows" />
            <CardContent>
              <Stack spacing={2}>
                <WorkflowItem 
                  name="User Activity Benchmarks" 
                  status="in-progress" 
                  progress={65}
                  updatedAt="30 minutes ago"
                />
                <WorkflowItem 
                  name="Product Catalog Test" 
                  status="completed" 
                  progress={100}
                  updatedAt="2 hours ago"
                />
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
                      <TableCell align="right">2</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Available Tables</TableCell>
                      <TableCell align="right">37</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>System Status</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                        Healthy
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
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
      <Avatar 
        sx={{ 
          bgcolor: config.bgcolor, 
          color: config.color, 
          mb: 1,
          width: 36,
          height: 36
        }}
      >
        {config.icon}
      </Avatar>
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

// Other View Components (simplified for brevity)
function WriteYamlView({ onNext }) {
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Write YAML Files
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Create NoSQLBench write workload YAML files from your Cassandra schema
      </Typography>
      
      <Card sx={{ mt: 4 }}>
        <CardHeader title="Upload Schema" />
        <CardContent>
          <Box 
            sx={{ 
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 6,
              textAlign: 'center'
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="body1" gutterBottom>
              Drag and drop your schema file here or click to browse
            </Typography>
            <Button 
              variant="contained" 
              component="label" 
              sx={{ mt: 2 }}
            >
              Select File
              <input type="file" hidden />
            </Button>
          </Box>
        </CardContent>
      </Card>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button 
          variant="contained" 
          onClick={onNext}
        >
          Next: Run NB5 Loader
        </Button>
      </Box>
    </Container>
  );
}

function LoaderView({ onNext }) {
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Run NB5 Loader
      </Typography>
      <Card sx={{ mt: 3 }}>
        <CardHeader title="Execute Workload" />
        <CardContent>
          <Typography variant="body1" paragraph>
            Configure your loader settings here
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="contained" onClick={onNext}>
              Next: DSBulk Unload
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

function UnloadView({ onNext }) {
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        DSBulk Unload
      </Typography>
      <Card sx={{ mt: 3 }}>
        <CardHeader title="Export Configuration" />
        <CardContent>
          <Typography variant="body1" paragraph>
            Configure your DSBulk export operation
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="contained" onClick={onNext}>
              Next: Generate Read YAML
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

function ReadYamlView({ onNext }) {
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Read YAML Files
      </Typography>
      <Card sx={{ mt: 3 }}>
        <CardHeader title="Read YAML Configuration" />
        <CardContent>
          <Typography variant="body1" paragraph>
            Configure your read YAML files
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="contained" onClick={onNext}>
              Next: Run NB5 Reader
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

function ReaderView({ onNext }) {
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Run NB5 Reader
      </Typography>
      <Card sx={{ mt: 3 }}>
        <CardHeader title="Reader Configuration" />
        <CardContent>
          <Typography variant="body1" paragraph>
            Configure your read operations
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="contained" onClick={onNext}>
              Next: CDM Migration
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

function MigrateView({ onNext }) {
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        CDM Migration
      </Typography>
      <Card sx={{ mt: 3 }}>
        <CardHeader title="Migration Configuration" />
        <CardContent>
          <Typography variant="body1" paragraph>
            Configure your data migration
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button variant="contained" onClick={onNext}>
              Finish Workflow
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

function SettingsView() {
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Card sx={{ mt: 3 }}>
        <CardHeader title="Application Settings" />
        <CardContent>
          <Typography variant="body1">
            Configure application settings here
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}

export default NoSQLBenchFlow;