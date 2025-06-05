import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardHeader,
  CardContent,
  Alert,
  Grid,
  Divider,
  Tab,
  Tabs,
  MenuItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemButton
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import StorageIcon from '@mui/icons-material/Storage';
import TerminalIcon from '@mui/icons-material/Terminal';
import DoneIcon from '@mui/icons-material/Done';
import ErrorIcon from '@mui/icons-material/Error';
import VisibilityIcon from '@mui/icons-material/Visibility';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';

import CommandGenerator from '../components/common/CommandGenerator';
import ConsoleViewer from '../components/common/ConsoleViewer';
import YamlViewer from '../components/common/YamlViewer';
import { useReadYamlContext } from '../context/ReadYamlContext';
import { useNB5Context } from '../context/NB5Context';
import { useAppContext } from '../context/AppContext';

const ReaderView = ({ onNext }) => {
  const { 
    generatedReadYamlFiles
  } = useReadYamlContext();
  
  const {
    executeNB5,
    generateCommand,
    activeExecution,
    executions,
    terminateExecution,
    getExecutionStatus,
    downloadScript,
    listExecutions
  } = useNB5Context();
  
  const { updateWorkflow } = useAppContext();
  
  const [selectedYamlIndex, setSelectedYamlIndex] = useState(0);
  const [isGeneratingCommand, setIsGeneratingCommand] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [yamlFilePath, setYamlFilePath] = useState('/tmp/read_yaml.yaml');
  const [formValues, setFormValues] = useState({
    yaml_file: yamlFilePath,
    host: 'localhost',
    datacenter: 'datacenter1',
    keyspace: 'baselines',
    additional_params: 'read-cycles=500000 threads=16'
  });
  const [executionTab, setExecutionTab] = useState('current');
  
  // Select the first YAML file when loaded
  useEffect(() => {
    if (generatedReadYamlFiles && generatedReadYamlFiles.length > 0) {
      // Set the file path based on frontend-generated path (example)
      // In a real application, you would save the file on the server and use the actual path
      const selectedFile = generatedReadYamlFiles[selectedYamlIndex];
      const fileName = selectedFile.filename;
      const filePath = `/tmp/${fileName}`;
      setYamlFilePath(filePath);
      
      // Update form values with the file path
      setFormValues(prev => ({
        ...prev,
        yaml_file: filePath
      }));
    }
  }, [generatedReadYamlFiles, selectedYamlIndex]);
  
  // Refresh executions list periodically
  useEffect(() => {
    // Initial load
    listExecutions().catch(err => console.error('Failed to load executions:', err));
    
    // Set up polling
    const interval = setInterval(() => {
      if (activeExecution && activeExecution.is_running) {
        getExecutionStatus(activeExecution.id)
          .catch(err => console.error(`Failed to get status for execution ${activeExecution.id}:`, err));
      } else {
        listExecutions().catch(err => console.error('Failed to update executions list:', err));
      }
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(interval);
  }, [activeExecution]);
  
  // Handle YAML tab change
  const handleYamlTabChange = (event, newValue) => {
    setSelectedYamlIndex(newValue);
  };
  
  // Handle execution tab change
  const handleExecutionTabChange = (event, newValue) => {
    setExecutionTab(newValue);
  };
  
  // Form fields for NB5 command generator
  const commandFields = [
    {
      name: 'yaml_file',
      label: 'YAML File Path',
      type: 'text',
      required: true,
      validate: (value) => {
        if (!value.trim()) return 'YAML file path is required';
        if (!value.endsWith('.yaml') && !value.endsWith('.yml')) {
          return 'File must have .yaml or .yml extension';
        }
        return true;
      }
    },
    {
      name: 'host',
      label: 'Cassandra Host',
      type: 'text',
      required: true
    },
    {
      name: 'datacenter',
      label: 'Local Data Center',
      type: 'text',
      required: true
    },
    {
      name: 'keyspace',
      label: 'Keyspace',
      type: 'text',
      required: true
    },
    {
      name: 'additional_params',
      label: 'Additional Parameters',
      type: 'text',
      multiline: true,
      rows: 2,
      placeholder: 'read-cycles=500000 threads=16'
    }
  ];
  
  // Handle command generation
  const handleGenerateCommand = async (values) => {
    setIsGeneratingCommand(true);
    
    try {
      const result = await generateCommand(values);
      setCurrentCommand(result.command);
      setFormValues(values);
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Generate NB5 Read Command',
          status: 'completed',
          timestamp: new Date(),
          details: `Generated command for ${values.yaml_file}`
        }]
      });
      
      return result;
    } catch (error) {
      console.error('Error generating command:', error);
      throw error;
    } finally {
      setIsGeneratingCommand(false);
    }
  };
  
  // Handle command execution
  const handleExecuteCommand = async (command, values) => {
    try {
      // Create a temporary object with the YAML content and other parameters
      const execParams = {
        yaml_content: generatedReadYamlFiles[selectedYamlIndex].content,
        host: values.host,
        datacenter: values.datacenter,
        keyspace: values.keyspace,
        additional_params: values.additional_params,
        timeout: 600 // 10 minutes timeout
      };
      
      // Execute the command
      const execution = await executeNB5(execParams);
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Execute NB5 Read Command',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Started read execution with ID: ${execution.id}`
        }]
      });
      
      setExecutionTab('current');
      
      return execution;
    } catch (error) {
      console.error('Error executing command:', error);
      throw error;
    }
  };
  
  // Handle script download
  const handleDownloadScript = async (values) => {
    try {
      await downloadScript({
        yaml_file: values.yaml_file,
        host: values.host,
        datacenter: values.datacenter,
        keyspace: values.keyspace,
        additional_params: values.additional_params
      });
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Download NB5 Read Script',
          status: 'completed',
          timestamp: new Date(),
          details: `Downloaded script for ${values.yaml_file}`
        }]
      });
    } catch (error) {
      console.error('Error downloading script:', error);
    }
  };
  
  // Handle execution termination
  const handleTerminateExecution = async (executionId) => {
    try {
      await terminateExecution(executionId);
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Terminate NB5 Execution',
          status: 'completed',
          timestamp: new Date(),
          details: `Terminated execution with ID: ${executionId}`
        }]
      });
    } catch (error) {
      console.error('Error terminating execution:', error);
    }
  };
  
  // Handle next button click
  const handleNext = () => {
    if (onNext && typeof onNext === 'function') {
      // Update workflow progress
      updateWorkflow({
        progress: 90, // 90% progress after completing this step
      });
      
      onNext();
    }
  };
  
  // Check if there's a valid execution that has completed
  const hasCompletedExecution = 
    activeExecution && 
    activeExecution.status === 'completed';
  
  // Get stdout and stderr from the active execution
  const stdout = activeExecution?.stdout || [];
  const stderr = activeExecution?.stderr || [];
  
  // Get recent executions
  const recentExecutions = executions
    .sort((a, b) => new Date(b.start_time || 0) - new Date(a.start_time || 0))
    .slice(0, 5);
  
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Run NB5 Reader
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Execute NoSQLBench read workloads to validate Cassandra tables
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Select Read YAML file to execute */}
        {generatedReadYamlFiles && generatedReadYamlFiles.length > 0 ? (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader 
                title="Select Read YAML File" 
                titleTypographyProps={{ variant: 'h6' }}
                avatar={<VisibilityIcon color="primary" />}
              />
              <Divider />
              
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={selectedYamlIndex} 
                  onChange={handleYamlTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {generatedReadYamlFiles.map((file, index) => (
                    <Tab 
                      key={index}
                      label={file.filename}
                      icon={<VisibilityIcon />}
                      iconPosition="start"
                    />
                  ))}
                </Tabs>
              </Box>
              
              <CardContent sx={{ bgcolor: 'grey.50', maxHeight: '300px', overflow: 'auto' }}>
                <pre style={{ 
                  margin: 0, 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem'
                }}>
                  {generatedReadYamlFiles[selectedYamlIndex]?.content}
                </pre>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          <Grid item xs={12}>
            <Alert severity="warning">
              No Read YAML files have been generated. Please go back to the previous step and generate Read YAML files.
            </Alert>
          </Grid>
        )}
        
        {/* Command Generator */}
        <Grid item xs={12}>
          <CommandGenerator
            title="NB5 Read Execution Configuration"
            fields={commandFields}
            initialValues={formValues}
            onGenerate={handleGenerateCommand}
            onExecute={handleExecuteCommand}
            onDownload={handleDownloadScript}
            isGenerating={isGeneratingCommand}
            isExecuting={activeExecution?.is_running}
            currentCommand={currentCommand}
            generateLabel="Generate NB5 Read Command"
            executeLabel="Execute Read Workload"
            downloadLabel="Download as Script"
          />
        </Grid>
        
        {/* Execution Output */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs 
                value={executionTab} 
                onChange={handleExecutionTabChange}
                variant="fullWidth"
              >
                <Tab 
                  label="Current Execution" 
                  value="current"
                  icon={<TerminalIcon />}
                  iconPosition="start"
                  disabled={!activeExecution}
                />
                <Tab 
                  label="Recent Executions" 
                  value="recent"
                  icon={<StorageIcon />}
                  iconPosition="start"
                />
              </Tabs>
            </Box>
            
            <CardContent>
              {executionTab === 'current' ? (
                activeExecution ? (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Chip 
                          label={activeExecution.status || 'unknown'} 
                          color={
                            activeExecution.status === 'completed' ? 'success' :
                            activeExecution.status === 'failed' || activeExecution.status === 'error' ? 'error' :
                            activeExecution.status === 'timeout' || activeExecution.status === 'terminated' ? 'warning' :
                            'info'
                          }
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Typography variant="subtitle1">
                          Execution ID: {activeExecution.execution_id}
                        </Typography>
                      </Box>
                      
                      {activeExecution.is_running && (
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<StopIcon />}
                          onClick={() => handleTerminateExecution(activeExecution.execution_id)}
                        >
                          Terminate
                        </Button>
                      )}
                    </Box>
                    
                    <ConsoleViewer
                      title={`Execution Output`}
                      output={stdout}
                      error={stderr}
                      isLoading={activeExecution.is_running}
                      onClear={() => {}} // We don't want to clear this output
                    />
                  </>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <TerminalIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No active execution. Generate and execute a command to see output.
                    </Typography>
                  </Box>
                )
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1">
                      Recent Executions
                    </Typography>
                    
                    <Button
                      size="small"
                      startIcon={<RefreshIcon />}
                      onClick={() => listExecutions()}
                    >
                      Refresh
                    </Button>
                  </Box>
                  
                  {recentExecutions.length > 0 ? (
                    <List component={Paper} variant="outlined" sx={{ mb: 2 }}>
                      {recentExecutions.map((exec) => (
                        <ListItemButton 
                          key={exec.execution_id}
                          sx={{ 
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            '&:last-child': { borderBottom: 'none' }
                          }}
                          onClick={() => {
                            getExecutionStatus(exec.execution_id);
                            setExecutionTab('current');
                          }}
                        >
                          <ListItemIcon>
                            {exec.status === 'completed' ? (
                              <DoneIcon color="success" />
                            ) : exec.status === 'failed' || exec.status === 'error' ? (
                              <ErrorIcon color="error" />
                            ) : exec.is_running ? (
                              <CircularProgress size={24} />
                            ) : (
                              <TerminalIcon />
                            )}
                          </ListItemIcon>
                          <ListItemText 
                            primary={`ID: ${exec.execution_id}`} 
                            secondary={
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                                <Chip 
                                  label={exec.status || 'unknown'} 
                                  color={
                                    exec.status === 'completed' ? 'success' :
                                    exec.status === 'failed' || exec.status === 'error' ? 'error' :
                                    exec.status === 'timeout' || exec.status === 'terminated' ? 'warning' :
                                    'info'
                                  }
                                  size="small"
                                />
                                <Typography variant="caption">
                                  {exec.start_time ? new Date(exec.start_time * 1000).toLocaleString() : 'Unknown time'}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No execution history found.
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Next Button */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleNext}
              endIcon={<NavigateNextIcon />}
              disabled={!hasCompletedExecution}
            >
              Next: CDM Migration
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ReaderView;