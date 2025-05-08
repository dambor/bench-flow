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
  CircularProgress
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SettingsIcon from '@mui/icons-material/Settings';
import StorageIcon from '@mui/icons-material/Storage';
import TerminalIcon from '@mui/icons-material/Terminal';
import DoneIcon from '@mui/icons-material/Done';
import ErrorIcon from '@mui/icons-material/Error';

import CommandGenerator from '../components/common/CommandGenerator';
import ConsoleViewer from '../components/common/ConsoleViewer';
import YamlViewer from '../components/common/YamlViewer';
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
  
  const [selectedYamlIndex, setSelectedYamlIndex] = useState(0);
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
  
  // Select the first YAML file when loaded
  useEffect(() => {
    if (generatedYamlFiles && generatedYamlFiles.length > 0) {
      // Set the file path based on frontend-generated path (example)
      // In a real application, you would save the file on the server and use the actual path
      const selectedFile = generatedYamlFiles[selectedYamlIndex];
      const fileName = selectedFile.filename;
      const filePath = `/tmp/${fileName}`;
      setYamlFilePath(filePath);
      
      // Update form values with the file path
      setFormValues(prev => ({
        ...prev,
        yaml_file: filePath
      }));
    }
  }, [generatedYamlFiles, selectedYamlIndex]);
  
  // Handle YAML tab change
  const handleYamlTabChange = (event, newValue) => {
    setSelectedYamlIndex(newValue);
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
        yaml_content: generatedYamlFiles[selectedYamlIndex].content,
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
              />
              <Divider />
              
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={selectedYamlIndex} 
                  onChange={handleYamlTabChange}
                  variant="scrollable"
                  scrollButtons="auto"
                >
                  {generatedYamlFiles.map((file, index) => (
                    <Tab 
                      key={index}
                      label={file.filename}
                      icon={<StorageIcon />}
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
                  {generatedYamlFiles[selectedYamlIndex]?.content}
                </pre>
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