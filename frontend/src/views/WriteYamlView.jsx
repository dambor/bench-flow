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
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  Paper,
  CircularProgress,
  TextField
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SchemaIcon from '@mui/icons-material/Schema';
import StorageIcon from '@mui/icons-material/Storage';
import TableViewIcon from '@mui/icons-material/TableView';
import DescriptionIcon from '@mui/icons-material/Description';

import FileUpload from '../components/common/FileUpload';
import { useSchemaContext } from '../context/SchemaContext';
import { useAppContext } from '../context/AppContext';

const WriteYamlView = ({ onNext }) => {
  const { 
    schemaData, 
    isParsingSchema, 
    selectedTables, 
    generatedYamlFiles,
    parseSchema, 
    generateYaml, 
    setSelectedTables 
  } = useSchemaContext();
  
  const { startWorkflow, updateWorkflow, addNotification } = useAppContext();
  
  const [isGeneratingYaml, setIsGeneratingYaml] = useState(false);
  const [selectAllTables, setSelectAllTables] = useState(true);
  const [selectedYamlFile, setSelectedYamlFile] = useState('');
  const [selectedYamlContent, setSelectedYamlContent] = useState('');
  
  // When schema data changes, update selected tables state
  useEffect(() => {
    if (schemaData && schemaData.tables) {
      const tableNames = Object.keys(schemaData.tables);
      setSelectedTables(tableNames);
      setSelectAllTables(true);
    }
  }, [schemaData]);
  
  // When generated YAML files change, update selected YAML file
  useEffect(() => {
    if (generatedYamlFiles && generatedYamlFiles.length > 0) {
      setSelectedYamlFile(generatedYamlFiles[0].filename);
      setSelectedYamlContent(generatedYamlFiles[0].content);
    }
  }, [generatedYamlFiles]);
  
  // Handle schema file selection
  const handleSchemaFileSelected = async (files) => {
    if (!files || files.length === 0) return;
    
    try {
      // Start a new workflow if one isn't already in progress
      startWorkflow("NoSQLBench Schema Generation", "Generate YAML files for NoSQLBench from Cassandra schema");
      
      await parseSchema(files[0]);
    } catch (error) {
      console.error('Error parsing schema:', error);
    }
  };
  
  // Handle select all tables change
  const handleSelectAllChange = (event) => {
    const checked = event.target.checked;
    setSelectAllTables(checked);
    
    if (checked && schemaData && schemaData.tables) {
      setSelectedTables(Object.keys(schemaData.tables));
    } else {
      setSelectedTables([]);
    }
  };
  
  // Handle individual table selection change
  const handleTableSelectionChange = (tableName) => {
    const isSelected = selectedTables.includes(tableName);
    
    if (isSelected) {
      setSelectedTables(prev => prev.filter(t => t !== tableName));
      if (selectAllTables) {
        setSelectAllTables(false);
      }
    } else {
      setSelectedTables(prev => [...prev, tableName]);
      
      // Check if all tables are now selected
      if (schemaData && schemaData.tables && 
          Object.keys(schemaData.tables).length === selectedTables.length + 1) {
        setSelectAllTables(true);
      }
    }
  };
  
  // Handle generate YAML button click
  const handleGenerateYaml = async () => {
    if (!schemaData || selectedTables.length === 0) {
      addNotification({
        type: 'error',
        title: 'No tables selected',
        message: 'Please select at least one table to generate YAML files'
      });
      return;
    }
    
    setIsGeneratingYaml(true);
    
    try {
      updateWorkflow({
        steps: [{
          name: 'Selecting Tables',
          status: 'completed',
          timestamp: new Date(),
          details: `Selected ${selectedTables.length} tables for YAML generation`
        }]
      });
      
      const files = await generateYaml(selectedTables);
      
      if (files && files.length > 0) {
        addNotification({
          type: 'success',
          title: 'YAML Generated',
          message: `Successfully generated ${files.length} YAML files`
        });
      }
    } catch (error) {
      console.error('Error generating YAML:', error);
    } finally {
      setIsGeneratingYaml(false);
    }
  };
  
  // Handle YAML file selection change
  const handleYamlFileChange = (event) => {
    const filename = event.target.value;
    setSelectedYamlFile(filename);
    
    // Find the corresponding content
    const file = generatedYamlFiles.find(f => f.filename === filename);
    if (file) {
      setSelectedYamlContent(file.content);
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
    
    addNotification({
      type: 'success',
      title: 'File Downloaded',
      message: `${selectedYamlFile} has been downloaded`,
    });
  };
  
  // Handle next button click
  const handleNext = () => {
    if (onNext && typeof onNext === 'function') {
      // Update workflow progress
      updateWorkflow({
        progress: 20, // 20% progress after completing this step
      });
      
      onNext();
    }
  };
  
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Write YAML Files
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Create NoSQLBench write workload YAML files from your Cassandra schema
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Step 1: Upload Schema */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardHeader 
              title="Step 1: Upload Schema" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<SchemaIcon color="primary" />}
            />
            <Divider />
            <CardContent>
              <FileUpload 
                accept=".cql,.txt"
                multiple={false}
                maxSize={5 * 1024 * 1024} // 5MB
                onFilesSelected={handleSchemaFileSelected}
                isLoading={isParsingSchema}
                helperText="Drag and drop your CQL schema file here or click to browse"
                buttonText="Select Schema File"
              />
              
              {schemaData && (
                <Alert 
                  severity="success" 
                  icon={<CheckCircleIcon fontSize="inherit" />}
                  sx={{ mt: 2 }}
                >
                  Schema parsed successfully! Found {Object.keys(schemaData.tables || {}).length} tables
                  and {Object.keys(schemaData.types || {}).length} user-defined types.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Step 2: Select Tables */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardHeader 
              title="Step 2: Select Tables" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<TableViewIcon color="primary" />}
              action={
                schemaData && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selectAllTables}
                        onChange={handleSelectAllChange}
                        disabled={!schemaData || isGeneratingYaml}
                      />
                    }
                    label="Select All"
                  />
                )
              }
            />
            <Divider />
            <CardContent sx={{ p: 0 }}>
              {!schemaData ? (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    Upload a schema file to view available tables
                  </Typography>
                </Box>
              ) : (
                <List dense sx={{ maxHeight: '300px', overflow: 'auto' }}>
                  {Object.entries(schemaData.tables || {}).map(([fullTableName, tableInfo]) => {
                    const isSelected = selectedTables.includes(fullTableName);
                    const primaryKeyColumns = tableInfo.primary_key 
                      ? tableInfo.primary_key.flat().join(', ') 
                      : 'No primary key';
                    
                    return (
                      <ListItem 
                        key={fullTableName}
                        dense
                        button
                        onClick={() => handleTableSelectionChange(fullTableName)}
                        disabled={isGeneratingYaml}
                        sx={{
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          bgcolor: isSelected ? 'rgba(63, 81, 181, 0.08)' : 'transparent',
                        }}
                      >
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={isSelected}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText 
                          primary={tableInfo.name || fullTableName.split('.').pop()}
                          secondary={
                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                              {tableInfo.keyspace && (
                                <Chip 
                                  label={tableInfo.keyspace} 
                                  size="small" 
                                  variant="outlined"
                                  color="primary"
                                />
                              )}
                              <Typography variant="caption" component="span">
                                PK: {primaryKeyColumns}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </CardContent>
            
            <Divider />
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {selectedTables.length} tables selected
              </Typography>
              <Button 
                variant="contained" 
                onClick={handleGenerateYaml}
                disabled={!schemaData || selectedTables.length === 0 || isGeneratingYaml}
                startIcon={isGeneratingYaml ? <CircularProgress size={20} /> : <StorageIcon />}
              >
                {isGeneratingYaml ? 'Generating...' : 'Generate YAML Files'}
              </Button>
            </Box>
          </Card>
        </Grid>
        
        {/* Step 3: Generated YAML Files */}
        {generatedYamlFiles && generatedYamlFiles.length > 0 && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader 
                title="Generated Write YAML Files" 
                titleTypographyProps={{ variant: 'h6' }}
                avatar={<DescriptionIcon color="primary" />}
                action={
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<DescriptionIcon />}
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
                        maxHeight: '400px', 
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
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleNext}
                endIcon={<NavigateNextIcon />}
              >
                Next: Run NB5 Loader
              </Button>
            </Box>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default WriteYamlView;