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
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import TerminalIcon from '@mui/icons-material/Terminal';
import DoneIcon from '@mui/icons-material/Done';
import StorageIcon from '@mui/icons-material/Storage';

import CommandGenerator from '../components/common/CommandGenerator';
import ConsoleViewer from '../components/common/ConsoleViewer';
import { useSchemaContext } from '../context/SchemaContext';
import { useDSBulkContext } from '../context/DSBulkContext';
import { useAppContext } from '../context/AppContext';

const UnloadView = ({ onNext }) => {
  const { 
    schemaData,
    generatedYamlFiles
  } = useSchemaContext();
  
  const {
    isValidated,
    dsbulkPath,
    isValidating,
    generateCommand,
    executeCommand,
    activeExecution,
    downloadScript
  } = useDSBulkContext();
  
  const { updateWorkflow } = useAppContext();
  
  const [tableOptions, setTableOptions] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [primaryKeyOptions, setPrimaryKeyOptions] = useState([]);
  const [isGeneratingCommand, setIsGeneratingCommand] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [formValues, setFormValues] = useState({
    keyspace: '',
    table: '',
    operation: 'unload',
    primary_key: '',
    output_path: '/tmp/dsbulk_export',
    limit: 1000000
  });
  
  // Populate table options when schema data is available
  useEffect(() => {
    if (schemaData && schemaData.tables) {
      const tables = Object.entries(schemaData.tables).map(([fullName, tableInfo]) => ({
        value: fullName,
        label: tableInfo.name || fullName.split('.').pop(),
        keyspace: tableInfo.keyspace || fullName.split('.')[0]
      }));
      
      setTableOptions(tables);
      
      // If we have tables, select the first one
      if (tables.length > 0) {
        setSelectedTable(tables[0].value);
        
        // Set keyspace and table in form values
        setFormValues(prev => ({
          ...prev,
          keyspace: tables[0].keyspace,
          table: tables[0].label
        }));
        
        // Set primary key options for the selected table
        updatePrimaryKeyOptions(tables[0].value);
      }
    }
  }, [schemaData]);
  
  // Update primary key options when selected table changes
  const updatePrimaryKeyOptions = (tableFullName) => {
    if (!schemaData || !schemaData.tables || !tableFullName) return;
    
    const tableInfo = schemaData.tables[tableFullName];
    if (!tableInfo || !tableInfo.primary_key) return;
    
    // Extract primary key columns
    const pkColumns = tableInfo.primary_key.flat(); // Flatten nested arrays
    
    setPrimaryKeyOptions(pkColumns.map(col => ({
      value: col,
      label: col
    })));
    
    // Set the first primary key column in form values
    if (pkColumns.length > 0) {
      setFormValues(prev => ({
        ...prev,
        primary_key: pkColumns[0]
      }));
    }
  };
  
  // Handle table selection change
  const handleTableChange = (event) => {
    const selectedTableFullName = event.target.value;
    setSelectedTable(selectedTableFullName);
    
    if (!selectedTableFullName || !schemaData || !schemaData.tables) return;
    
    const tableInfo = schemaData.tables[selectedTableFullName];
    if (!tableInfo) return;
    
    // Update form values
    setFormValues(prev => ({
      ...prev,
      keyspace: tableInfo.keyspace,
      table: tableInfo.name
    }));
    
    // Update primary key options
    updatePrimaryKeyOptions(selectedTableFullName);
  };
  
  // Form fields for DSBulk command generator
  const commandFields = [
    {
      name: 'operation',
      label: 'Operation',
      type: 'select',
      required: true,
      options: [
        { value: 'unload', label: 'Unload (Export)' },
        { value: 'count', label: 'Count Rows' }
      ]
    },
    {
      name: 'keyspace',
      label: 'Keyspace',
      type: 'text',
      required: true
    },
    {
      name: 'table',
      label: 'Table',
      type: 'select',
      required: true,
      options: tableOptions
    },
    {
      name: 'primary_key',
      label: 'Primary Key Column',
      type: 'select',
      required: true,
      options: primaryKeyOptions,
      disabled: formValues.operation === 'count'
    },
    {
      name: 'output_path',
      label: 'Output Path',
      type: 'text',
      required: true,
      disabled: formValues.operation === 'count'
    },
    {
      name: 'limit',
      label: 'Limit',
      type: 'text',
      inputType: 'number',
      required: false,
      disabled: formValues.operation === 'count'
    }
  ];
  
  // Handle command generation
  const handleGenerateCommand = async (values) => {
    setIsGeneratingCommand(true);
    
    try {
      // Different params based on operation
      const params = {
        operation: values.operation,
        keyspace: values.keyspace,
        table: values.table
      };
      
      // Add operation-specific parameters
      if (values.operation === 'unload') {
        params.primary_key = values.primary_key;
        params.output_path = values.output_path;
        if (values.limit) {
          params.limit = parseInt(values.limit, 10);
        }
      }
      
      const result = await generateCommand(params);
      setCurrentCommand(result.command);
      setFormValues(values);
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Generate DSBulk Command',
          status: 'completed',
          timestamp: new Date(),
          details: `Generated ${values.operation} command for ${values.keyspace}.${values.table}`
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
  const handleExecuteCommand = async (command) => {
    try {
      // Execute the command
      const execution = await executeCommand(command, true);
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Execute DSBulk Command',
          status: execution.result.success ? 'completed' : 'failed',
          timestamp: new Date(),
          details: execution.result.success 
            ? `Successfully executed ${formValues.operation} on ${formValues.keyspace}.${formValues.table}` 
            : `Failed to execute ${formValues.operation}: ${execution.result.error || 'Unknown error'}`
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
      // Different params based on operation
      const params = {
        keyspace: values.keyspace,
        table: values.table,
        primary_key: values.primary_key,
        output_path: values.output_path
      };
      
      if (values.limit) {
        params.limit = parseInt(values.limit, 10);
      }
      
      await downloadScript(params);
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Download DSBulk Script',
          status: 'completed',
          timestamp: new Date(),
          details: `Downloaded unload script for ${values.keyspace}.${values.table}`
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
        progress: 50, // 50% progress after completing this step
      });
      
      onNext();
    }
  };
  
  // Check if there's a valid execution that has completed
  const hasCompletedExecution = 
    activeExecution && 
    activeExecution.result && 
    activeExecution.result.success;
  
  // Get stdout and stderr from the active execution
  const stdout = activeExecution?.result?.stdout?.split('\n') || [];
  const stderr = activeExecution?.result?.stderr?.split('\n') || [];
  
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        DSBulk Unload
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Export primary key values from Cassandra tables for read operations
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Status Card */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardHeader 
              title="DSBulk Status" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<SettingsIcon color="primary" />}
            />
            <Divider />
            <CardContent>
              {isValidating ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CircularProgress size={24} sx={{ mr: 2 }} />
                  <Typography>Checking DSBulk installation...</Typography>
                </Box>
              ) : isValidated ? (
                <Alert severity="success" icon={<DoneIcon />}>
                  DSBulk is installed and ready to use at: {dsbulkPath}
                </Alert>
              ) : (
                <Alert severity="warning">
                  DSBulk was not found at the expected location. Please make sure DSBulk is installed.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Command Generator */}
        <Grid item xs={12}>
          <CommandGenerator
            title="DSBulk Unload Configuration"
            fields={commandFields}
            initialValues={formValues}
            onGenerate={handleGenerateCommand}
            onExecute={handleExecuteCommand}
            onDownload={handleDownloadScript}
            isGenerating={isGeneratingCommand}
            isExecuting={activeExecution && !hasCompletedExecution}
            currentCommand={currentCommand}
            generateLabel="Generate DSBulk Command"
            executeLabel="Execute Command"
            downloadLabel="Download as Script"
            formDirection="row"
          />
        </Grid>
        
        {/* Execution Output */}
        {activeExecution && (
          <Grid item xs={12}>
            <ConsoleViewer
              title="Execution Output"
              output={stdout}
              error={stderr}
              isLoading={!hasCompletedExecution}
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
              disabled={!hasCompletedExecution && formValues.operation === 'unload'}
            >
              Next: Read YAML Generator
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default UnloadView;