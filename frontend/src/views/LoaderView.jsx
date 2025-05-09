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
  FormControl,
  InputLabel,
  Select,
  Paper
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import TerminalIcon from '@mui/icons-material/Terminal';
import DoneIcon from '@mui/icons-material/Done';
import ErrorIcon from '@mui/icons-material/Error';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

import CommandGenerator from '../components/common/CommandGenerator';
import ConsoleViewer from '../components/common/ConsoleViewer';
import { useSchemaContext } from '../context/SchemaContext';
import { useNB5Context } from '../context/NB5Context';
import { useAppContext } from '../context/AppContext';

const LoaderView = ({ onNext }) => {
  const { 
    generatedYamlFiles 
  } = useSchemaContext();
  
  const {
    isValidated,
    nb5Path,
    isValidating,
    executeNB5,
    generateCommand,
    activeExecution,
    downloadScript
  } = useNB5Context();
  
  const { updateWorkflow } = useAppContext();
  
  const [selectedYamlFile, setSelectedYamlFile] = useState('');
  const [selectedYamlContent, setSelectedYamlContent] = useState('');
  const [isGeneratingCommand, setIsGeneratingCommand] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [yamlFilePath, setYamlFilePath] = useState('');
  const [formValues, setFormValues] = useState({
    yaml_file: '/path/to/yaml_file.yaml',
    host: 'localhost',
    datacenter: 'datacenter1',
    keyspace: 'baselines',
    additional_params: 'cycles=5000000 threads=8'
  });
  
  // Initialize selected YAML file when component mounts or files change
  useEffect(() => {
    if (generatedYamlFiles && generatedYamlFiles.length > 0) {
      const firstFile = generatedYamlFiles[0];
      setSelectedYamlFile(firstFile.filename);
      setSelectedYamlContent(firstFile.content);
      
      // Set the file path based on frontend-generated path (example)
      // In a real application, you would save the file on the server and use the actual path
      const filePath = `/tmp/${firstFile.filename}`;
      setYamlFilePath(filePath);
      
      // Update form values with the file path
      setFormValues(prev => ({
        ...prev,
        yaml_file: filePath
      }));
    }
  }, [generatedYamlFiles]);
  
  // Handle YAML file selection change
  const handleYamlFileChange = (event) => {
    const filename = event.target.value;
    setSelectedYamlFile(filename);
    
    // Find the corresponding content
    const file = generatedYamlFiles.find(f => f.filename === filename);
    if (file) {
      setSelectedYamlContent(file.content);
      
      // Update the file path
      const filePath = `/tmp/${filename}`;
      setYamlFilePath(filePath);
      
      // Update form values with the file path
      setFormValues(prev => ({
        ...prev,
        yaml_file: filePath
      }));
    }
  };
  
  // Handle download of the selected YAML file
  const handleDownloadYaml = () => {
    if (!selectedYamlFile || !selectedYamlContent) return;
    
    const blob = new Blob([selectedYamlContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedYamlFile;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
    // Update workflow step
    updateWorkflow({
      steps: [{
        name: 'Download YAML',
        status: 'completed',
        timestamp: new Date(),
        details: `Downloaded ${selectedYamlFile}`
      }]
    });
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
      placeholder: 'cycles=1000000 threads=8'
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
          name: 'Generate NB5 Command',
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
        yaml_content: selectedYamlContent,
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
          name: 'Execute NB5 Command',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Started execution with ID: ${execution.id}`
        }]
      });
      
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
          name: 'Download NB5 Script',
          status: 'completed',
          timestamp: new Date(),
          details: `Downloaded script for ${values.yaml_file}`
        }]
      });
    } catch (error) {
      console.error('Error downloading script:', error);
    }
  };
  
  // Handle next button click
  const handleNext = () => {
    if (onNext && typeof onNext === 'function') {
      // Update workflow progress
      updateWorkflow({
        progress: 35, // 35% progress after completing this step
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
  
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Run NB5 Loader
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Execute NoSQLBench workloads to populate Cassandra tables
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Select YAML file to execute */}
        {generatedYamlFiles && generatedYamlFiles.length > 0 ? (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader 
                title="Select Write YAML File" 
                titleTypographyProps={{ variant: 'h6' }}
                avatar={<StorageIcon color="primary" />}
                action={
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<CloudDownloadIcon />}
                    onClick={handleDownloadYaml}
                    disabled={!selectedYamlFile}
                  >
                    Download
                  </Button>
                }
              />
              <Divider />
              
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel id="yaml-file-select-label">Select YAML File</InputLabel>
                      <Select
                        labelId="yaml-file-select-label"
                        id="yaml-file-select"
                        value={selectedYamlFile}
                        label="Select YAML File"
                        onChange={handleYamlFileChange}
                      >
                        {generatedYamlFiles.map((file, index) => (
                          <MenuItem key={index} value={file.filename}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <DescriptionIcon sx={{ mr: 1, fontSize: 20, color: 'primary.main' }} />
                              {file.filename}
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        bgcolor: 'grey.50', 
                        maxHeight: '300px', 
                        overflow: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {selectedYamlContent}
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          <Grid item xs={12}>
            <Alert severity="warning">
              No YAML files have been generated. Please go back to the previous step and generate YAML files.
            </Alert>
          </Grid>
        )}
        
        {/* Command Generator */}
        <Grid item xs={12}>
          <CommandGenerator
            title="NB5 Execution Configuration"
            fields={commandFields}
            initialValues={formValues}
            onGenerate={handleGenerateCommand}
            onExecute={handleExecuteCommand}
            onDownload={handleDownloadScript}
            isGenerating={isGeneratingCommand}
            isExecuting={activeExecution?.is_running}
            currentCommand={currentCommand}
            generateLabel="Generate NB5 Command"
            executeLabel="Execute Workload"
            downloadLabel="Download as Script"
          />
        </Grid>
        
        {/* Execution Output */}
        {activeExecution && (
          <Grid item xs={12}>
            <ConsoleViewer
              title={`Execution Output - ${activeExecution.status || 'running'}`}
              output={stdout}
              error={stderr}
              isLoading={activeExecution.is_running}
              onClear={() => {}} // We don't want to clear this output
            />
          </Grid>
        )}
        
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
              Next: DSBulk Unload
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default LoaderView;