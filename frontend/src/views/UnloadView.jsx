// Modified UnloadView.jsx that parses the original CQL schema
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
import FileUpload from '../components/common/FileUpload';
import { useSchemaContext } from '../context/SchemaContext';
import { useDSBulkContext } from '../context/DSBulkContext';
import { useAppContext } from '../context/AppContext';

const UnloadView = ({ onNext }) => {
  const { 
    schemaData,
    parseSchema,
    isParsingSchema
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
  
  const { updateWorkflow, addNotification } = useAppContext();
  
  // State for schema file upload
  const [schemaFile, setSchemaFile] = useState(null);
  const [isParsingCQL, setIsParsingCQL] = useState(false);
  
  // State for table data
  const [tableOptions, setTableOptions] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [primaryKeyOptions, setPrimaryKeyOptions] = useState([]);
  
  // State for command generator
  const [isGeneratingCommand, setIsGeneratingCommand] = useState(false);
  const [currentCommand, setCurrentCommand] = useState('');
  const [formValues, setFormValues] = useState({
    keyspace: 'centralpayment',
    table: '',
    operation: 'unload',
    primary_key: '',
    output_path: '/tmp/dsbulk_export',
    limit: 1000000
  });
  
  // Check for schema data when component mounts
  useEffect(() => {
    if (schemaData && schemaData.tables) {
      populateTableOptions(schemaData);
    }
  }, [schemaData]);
  
  // Populate table options from schema data
  const populateTableOptions = (schema) => {
    if (!schema || !schema.tables) return;
    
    const tables = Object.entries(schema.tables).map(([fullName, tableInfo]) => ({
      value: fullName,
      label: tableInfo.name || fullName.split('.').pop(),
      keyspace: tableInfo.keyspace || fullName.split('.')[0]
    }));
    
    console.log("Schema tables loaded:", tables);
    setTableOptions(tables);
    
    // If we have tables, select the first one
    if (tables.length > 0) {
      setSelectedTable(tables[0].value);
      
      // Set keyspace and table in form values
      setFormValues(prev => ({
        ...prev,
        keyspace: tables[0].keyspace || 'centralpayment',
        table: tables[0].label
      }));
      
      // Set primary key options for the selected table
      updatePrimaryKeyOptions(tables[0].value, schema);
    }
  };
  
  // Update primary key options when selected table changes
  const updatePrimaryKeyOptions = (tableFullName, schema = schemaData) => {
    if (!schema || !schema.tables || !tableFullName) return;
    
    const tableInfo = schema.tables[tableFullName];
    if (!tableInfo || !tableInfo.primary_key) return;
    
    // Extract primary key columns - flatten nested arrays
    const pkColumns = [];
    tableInfo.primary_key.forEach(part => {
      if (Array.isArray(part)) {
        pkColumns.push(...part);
      } else {
        pkColumns.push(part);
      }
    });
    
    console.log("Primary key columns for", tableFullName, ":", pkColumns);
    
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
  
  // Handle schema file upload and parsing
  const handleSchemaFileSelected = async (files) => {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setSchemaFile(file);
    
    // Parse the schema file
    setIsParsingCQL(true);
    try {
      const parsedSchema = await parseSchema(file);
      
      // Update the UI with the parsed schema
      populateTableOptions(parsedSchema);
      
      addNotification({
        type: 'success',
        title: 'Schema Parsed',
        message: `Successfully parsed schema with ${Object.keys(parsedSchema.tables || {}).length} tables`
      });
    } catch (error) {
      console.error("Error parsing schema file:", error);
      addNotification({
        type: 'error',
        title: 'Parsing Error',
        message: 'Could not parse the schema file'
      });
    } finally {
      setIsParsingCQL(false);
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
      keyspace: tableInfo.keyspace || 'centralpayment',
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
        
        {/* Schema Upload Card */}
        <Grid item xs={12}>
          <Card variant="outlined">
            <CardHeader 
              title="CQL Schema" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<StorageIcon color="primary" />}
            />
            <Divider />
            <CardContent>
              {!schemaData || Object.keys(schemaData.tables || {}).length === 0 ? (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Please upload your CQL schema file to load tables and primary keys
                  </Alert>
                  
                  <FileUpload 
                    accept=".cql,.txt"
                    multiple={false}
                    maxSize={5 * 1024 * 1024} // 5MB
                    onFilesSelected={handleSchemaFileSelected}
                    isLoading={isParsingCQL || isParsingSchema}
                    helperText="Upload your CQL schema file containing table definitions"
                    buttonText="Select Schema File"
                  />
                </>
              ) : (
                <>
                  <Alert 
                    severity="success" 
                    icon={<DoneIcon fontSize="inherit" />}
                  >
                    Schema loaded: {schemaFile?.name || "Schema data loaded"}
                    <br/>
                    Found {Object.keys(schemaData.tables || {}).length} tables in the schema
                  </Alert>
                  
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel id="table-select-label">Select Table</InputLabel>
                        <Select
                          labelId="table-select-label"
                          id="table-select"
                          value={selectedTable}
                          label="Select Table"
                          onChange={handleTableChange}
                        >
                          {tableOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label} ({option.keyspace})
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          Select a table to export primary keys from
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel id="primary-key-label">Primary Key Column</InputLabel>
                        <Select
                          labelId="primary-key-label"
                          id="primary-key-select"
                          value={formValues.primary_key}
                          label="Primary Key Column"
                          onChange={(e) => setFormValues(prev => ({ ...prev, primary_key: e.target.value }))}
                          disabled={primaryKeyOptions.length === 0}
                        >
                          {primaryKeyOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>
                          Select primary key column to extract
                        </FormHelperText>
                      </FormControl>
                    </Grid>
                  </Grid>
                </>
              )}
              
              {(isParsingCQL || isParsingSchema) && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                  <CircularProgress size={24} sx={{ mr: 2 }} />
                  <Typography>Parsing schema file...</Typography>
                </Box>
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