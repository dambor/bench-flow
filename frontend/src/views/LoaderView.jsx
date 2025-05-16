// Modified LoaderView.jsx with "Execute Workload" button removed
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
  CircularProgress,
  TextField,
  Paper
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SettingsIcon from '@mui/icons-material/Settings';
import DescriptionIcon from '@mui/icons-material/Description';
import DoneIcon from '@mui/icons-material/Done';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import CommandGenerator from '../components/common/CommandGenerator';
import ConsoleViewer from '../components/common/ConsoleViewer';
import FileUpload from '../components/common/FileUpload';
import { useNB5Context } from '../context/NB5Context';
import { useAppContext } from '../context/AppContext';
import { useYamlContext } from '../context/YamlContext';

const LoaderView = ({ onNext }) => {
  const {
    isValidated,
    nb5Path,
    isValidating,
    executeNB5,
    generateCommand,
    activeExecution,
    downloadScript
  } = useNB5Context();
  
  const { generatedYaml, downloadYaml } = useYamlContext();
  const { updateWorkflow, addNotification } = useAppContext();
  
  // State for managing YAML files
  const [yamlFile, setYamlFile] = useState(null);
  const [yamlContent, setYamlContent] = useState('');
  const [isUploadMode, setIsUploadMode] = useState(false);
  
  // State for command generation and execution
  const [isGeneratingCommand, setIsGeneratingCommand] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  
  // Determine the full path dynamically
  const getDefaultYamlPath = () => {
    if (generatedYaml && generatedYaml.sessionId && generatedYaml.filename) {
      return `/Users/glenio.borges/workspace/bench-flow/backend/sessions/${generatedYaml.sessionId}/${generatedYaml.filename}`;
    }
    return '/Users/glenio.borges/workspace/bench-flow/backend/sessions/output.yaml';
  };
  
  const [formValues, setFormValues] = useState({
    yaml_file: getDefaultYamlPath(),
    host: 'localhost',
    datacenter: 'datacenter1',
    keyspace: 'baselines'
  });
  
  // When component mounts, check if there's YAML content in the context
  useEffect(() => {
    if (generatedYaml && generatedYaml.content) {
      setYamlContent(generatedYaml.content);
      
      // Update the YAML file path with the full path
      if (generatedYaml.sessionId && generatedYaml.filename) {
        const fullPath = `/Users/glenio.borges/workspace/bench-flow/backend/sessions/${generatedYaml.sessionId}/${generatedYaml.filename}`;
        setFormValues(prev => ({
          ...prev,
          yaml_file: fullPath
        }));
        console.log('Using full path for YAML file:', fullPath);
      }
    }
  }, [generatedYaml]);
  
  // Handle file upload
  const handleYamlFileSelected = (files) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setYamlFile(file);
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      setYamlContent(e.target.result);
    };
    reader.readAsText(file);
    
    // Create a unique session ID for this file
    const mockSessionId = `upload_${Date.now()}`;
    
    // Update form values with a server-side path
    const serverPath = `/Users/glenio.borges/workspace/bench-flow/backend/sessions/${mockSessionId}/${file.name}`;
      
    setFormValues(prev => ({
      ...prev,
      yaml_file: serverPath
    }));
    
    console.log('YAML file selected:', {
      name: file.name,
      size: file.size,
      type: file.type,
      path: serverPath
    });
  };
  
  // Toggle between upload mode and direct input mode
  const handleToggleMode = () => {
    setIsUploadMode(!isUploadMode);
  };
  
  // Handle direct YAML input changes
  const handleYamlInputChange = (event) => {
    setYamlContent(event.target.value);
  };
  
  // Form fields for NB5 command generator - REMOVED additional_params field
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
      },
      helperText: 'Full path to the YAML file on the server'
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
    }
  ];
  
  // Handle command generation
  const handleGenerateCommand = async (values) => {
    setIsGeneratingCommand(true);
    
    try {
      // Add fixed additional parameters
      const commandValues = {
        ...values,
        additional_params: 'cycles=5000000 threads=8'
      };
      
      const result = await generateCommand(commandValues);
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
  
  // Handle script download - with fixed additional parameters
  const handleDownloadScript = async (values) => {
    try {
      await downloadScript({
        yaml_file: values.yaml_file,
        host: values.host,
        datacenter: values.datacenter,
        keyspace: values.keyspace,
        additional_params: 'cycles=5000000 threads=8' // Fixed parameters
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
  
  // Add this function to ensure we properly access stdout/stderr
  const getExecutionOutput = () => {
    if (!activeExecution) return { stdout: [], stderr: [] };
    
    // Check if stdout/stderr are arrays
    const stdout = Array.isArray(activeExecution.stdout) ? activeExecution.stdout : 
                  (typeof activeExecution.stdout === 'string' ? activeExecution.stdout.split('\n') : []);
    
    const stderr = Array.isArray(activeExecution.stderr) ? activeExecution.stderr : 
                  (typeof activeExecution.stderr === 'string' ? activeExecution.stderr.split('\n') : []);
    
    return { stdout, stderr };
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
  
  // Get stdout and stderr from the active execution
  const { stdout, stderr } = getExecutionOutput();
  
  // Download the current YAML content as a file
  const handleSaveYamlToFile = () => {
    if (!yamlContent) {
      addNotification({
        type: 'warning',
        title: 'No Content',
        message: 'There is no YAML content to download'
      });
      return;
    }
    
    const blob = new Blob([yamlContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const filename = yamlFile ? yamlFile.name : (generatedYaml.filename || 'workload.yaml');
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
    addNotification({
      type: 'success',
      title: 'File Downloaded',
      message: `${filename} has been downloaded`
    });
  };
  
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Run NB5 Loader
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Execute NoSQLBench workloads to populate Cassandra tables
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* YAML File Selection/Display */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardHeader 
              title="YAML Workload File" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<DescriptionIcon color="primary" />}
              action={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={isUploadMode ? <DescriptionIcon /> : <FileUploadIcon />}
                    onClick={handleToggleMode}
                  >
                    {isUploadMode ? 'Direct Input' : 'File Upload'}
                  </Button>
                  {yamlContent && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CloudDownloadIcon />}
                      onClick={handleSaveYamlToFile}
                    >
                      Download
                    </Button>
                  )}
                </Box>
              }
            />
            <Divider />
            
            <CardContent>
              {isUploadMode ? (
                <FileUpload 
                  accept=".yaml,.yml"
                  multiple={false}
                  maxSize={5 * 1024 * 1024} // 5MB
                  onFilesSelected={handleYamlFileSelected}
                  isLoading={false}
                  helperText="Upload a NoSQLBench YAML workload file"
                  buttonText="Select YAML File"
                />
              ) : (
                <>
                  {generatedYaml.content ? (
                    <Alert 
                      severity="success" 
                      icon={<DoneIcon fontSize="inherit" />}
                      sx={{ mb: 2 }}
                    >
                      Using YAML file from previous step: {generatedYaml.filename || 'workload.yaml'}
                      <br />
                      <Typography variant="caption">
                        Full path: {formValues.yaml_file}
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert 
                      severity="info"
                      sx={{ mb: 2 }}
                    >
                      No YAML file from previous step. You can enter content directly or switch to file upload.
                    </Alert>
                  )}
                  <TextField
                    fullWidth
                    multiline
                    rows={12}
                    label="YAML Content"
                    value={yamlContent}
                    onChange={handleYamlInputChange}
                    placeholder="Paste your YAML content here..."
                    InputProps={{
                      style: { fontFamily: 'monospace', fontSize: '0.85rem' }
                    }}
                  />
                </>
              )}
              
              {yamlFile && isUploadMode && (
                <Alert 
                  severity="success" 
                  icon={<DoneIcon fontSize="inherit" />}
                  sx={{ mt: 2 }}
                >
                  YAML file loaded: {yamlFile.name}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* NB5 Status */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardHeader 
              title="NB5 Status" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<SettingsIcon color="primary" />}
            />
            <Divider />
            <CardContent>
              {isValidating ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={24} sx={{ mr: 2 }} />
                  <Typography>Checking NB5 installation...</Typography>
                </Box>
              ) : isValidated ? (
                <Alert severity="success" icon={<DoneIcon />}>
                  NB5 is installed and ready to use at: {nb5Path}
                </Alert>
              ) : (
                <Alert severity="warning">
                  NB5 was not found at the expected location. Please make sure NB5 is installed.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Command Generator - WITH EXECUTE BUTTON REMOVED */}
        {yamlContent && (
          <Grid item xs={12}>
            <CommandGenerator
              title="NB5 Execution Configuration"
              fields={commandFields}
              initialValues={formValues}
              onGenerate={handleGenerateCommand}
              onDownload={handleDownloadScript}
              isGenerating={isGeneratingCommand}
              isExecuting={false}
              currentCommand={currentCommand}
              generateLabel="Generate NB5 Command"
              downloadLabel="Download as Script"
              showExecuteButton={false} // This is the key change - hide the execute button
            />
          </Grid>
        )}
        
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