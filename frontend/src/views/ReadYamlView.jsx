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
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SettingsIcon from '@mui/icons-material/Settings';
import DoneIcon from '@mui/icons-material/Done';

import FileUpload from '../components/common/FileUpload';
import YamlViewer from '../components/common/YamlViewer';
import { useSchemaContext } from '../context/SchemaContext';
import { useReadYamlContext } from '../context/ReadYamlContext';
import { useDSBulkContext } from '../context/DSBulkContext';
import { useAppContext } from '../context/AppContext';

const ReadYamlView = ({ onNext }) => {
  const { 
    generatedYamlFiles 
  } = useSchemaContext();
  
  const {
    generatedReadYamlFiles,
    isProcessing,
    primaryKeyColumns,
    csvPath,
    processIngestionZip,
    processMultipleFiles,
    processIngestionFile,
    generateReadYaml,
    generateReadYamlJson,
    setPrimaryKeyColumns,
    setCsvPath
  } = useReadYamlContext();
  
  const {
    activeExecution
  } = useDSBulkContext();
  
  const { updateWorkflow } = useAppContext();
  
  const [tabValue, setTabValue] = useState(0);
  const [hasCompletedGeneration, setHasCompletedGeneration] = useState(false);
  const [pkInput, setPkInput] = useState('');
  const [csvPathInput, setCsvPathInput] = useState('');
  const [selectedWriteYaml, setSelectedWriteYaml] = useState(null);
  
  // Set CSV path from DSBulk execution if available
  useEffect(() => {
    if (activeExecution && 
        activeExecution.result && 
        activeExecution.result.success && 
        formValues && 
        formValues.output_path) {
      setCsvPathInput(formValues.output_path);
      setCsvPath(formValues.output_path);
    }
  }, [activeExecution]);
  
  // Update when read YAML files are generated
  useEffect(() => {
    if (generatedReadYamlFiles && generatedReadYamlFiles.length > 0) {
      setHasCompletedGeneration(true);
    }
  }, [generatedReadYamlFiles]);
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
  
  // Handle primary key input change
  const handlePkInputChange = (event) => {
    setPkInput(event.target.value);
  };
  
  // Handle CSV path input change
  const handleCsvPathInputChange = (event) => {
    setCsvPathInput(event.target.value);
  };
  
  // Handle upload of zip file containing ingestion YAML files
  const handleZipUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    try {
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Process Ingestion ZIP',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Processing ZIP file: ${files[0].name}`
        }]
      });
      
      await processIngestionZip(files[0]);
      
      setHasCompletedGeneration(true);
    } catch (error) {
      console.error('Error processing zip file:', error);
    }
  };
  
  // Handle upload of multiple YAML files
  const handleMultipleYamlUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    try {
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Process Multiple YAML Files',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Processing ${files.length} YAML files`
        }]
      });
      
      await processMultipleFiles(files);
      
      setHasCompletedGeneration(true);
    } catch (error) {
      console.error('Error processing multiple files:', error);
    }
  };
  
  // Handle upload of single YAML file
  const handleSingleYamlUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setSelectedWriteYaml(files[0]);
  };
  
  // Handle generate read YAML button click
  const handleGenerateReadYaml = async () => {
    if (!selectedWriteYaml || !csvPathInput || !pkInput) return;
    
    try {
      // Split primary key input into an array and trim whitespace
      const pkCols = pkInput.split(',').map(col => col.trim());
      setPrimaryKeyColumns(pkCols);
      setCsvPath(csvPathInput);
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Generate Read YAML',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Generating Read YAML for ${selectedWriteYaml.name}`
        }]
      });
      
      await generateReadYaml(selectedWriteYaml, csvPathInput, pkInput);
      
      setHasCompletedGeneration(true);
    } catch (error) {
      console.error('Error generating read YAML:', error);
    }
  };
  
  // Handle next button click
  const handleNext = () => {
    if (onNext && typeof onNext === 'function') {
      // Update workflow progress
      updateWorkflow({
        progress: 75, // 75% progress after completing this step
      });
      
      onNext();
    }
  };
  
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        Generate Read YAML Files
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Create NoSQLBench read workload YAML files from your write YAML or DSBulk export
      </Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="read yaml generation tabs"
          variant="fullWidth"
        >
          <Tab 
            icon={<DescriptionIcon />} 
            iconPosition="start" 
            label="From Upload" 
            id="tab-0"
          />
          <Tab 
            icon={<AutoStoriesIcon />} 
            iconPosition="start" 
            label="From Generated Files" 
            id="tab-1"
            disabled={!generatedYamlFiles || generatedYamlFiles.length === 0}
          />
          <Tab 
            icon={<VisibilityIcon />} 
            iconPosition="start" 
            label="Custom Generation" 
            id="tab-2"
          />
        </Tabs>
      </Box>
      
      <Grid container spacing={3}>
        {/* Tab 0: From Upload */}
        {tabValue === 0 && (
          <>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardHeader 
                  title="Upload Ingestion YAML Files (ZIP)" 
                  titleTypographyProps={{ variant: 'h6' }}
                  avatar={<CloudUploadIcon color="primary" />}
                />
                <Divider />
                <CardContent>
                  <FileUpload 
                    accept=".zip"
                    multiple={false}
                    maxSize={10 * 1024 * 1024} // 10MB
                    onFilesSelected={handleZipUpload}
                    isLoading={isProcessing}
                    helperText="Upload a ZIP file containing ingestion YAML files"
                    buttonText="Select ZIP file"
                  />
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardHeader 
                  title="Upload Multiple YAML Files" 
                  titleTypographyProps={{ variant: 'h6' }}
                  avatar={<DescriptionIcon color="primary" />}
                />
                <Divider />
                <CardContent>
                  <FileUpload 
                    accept=".yaml,.yml"
                    multiple={true}
                    maxFiles={10}
                    maxSize={5 * 1024 * 1024} // 5MB per file
                    onFilesSelected={handleMultipleYamlUpload}
                    isLoading={isProcessing}
                    helperText="Upload one or more individual YAML files"
                    buttonText="Select YAML files"
                  />
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
        
        {/* Tab 1: From Generated Files */}
        {tabValue === 1 && generatedYamlFiles && generatedYamlFiles.length > 0 && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader 
                title="Convert Generated Write YAML Files" 
                titleTypographyProps={{ variant: 'h6' }}
                avatar={<AutoStoriesIcon color="primary" />}
              />
              <Divider />
              <CardContent>
                <Alert severity="info" sx={{ mb: 3 }}>
                  The generated read YAML files will reference the DSBulk CSV export and use 
                  the primary key values to perform read operations.
                </Alert>
                
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="CSV Export Path (from DSBulk unload)"
                      value={csvPathInput}
                      onChange={handleCsvPathInputChange}
                      helperText="Path to the CSV file generated by DSBulk unload"
                      variant="outlined"
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      required
                      label="Primary Key Column(s)"
                      value={pkInput}
                      onChange={handlePkInputChange}
                      helperText="Comma-separated list of primary key columns"
                      variant="outlined"
                      margin="normal"
                    />
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={!pkInput || !csvPathInput || isProcessing}
                    onClick={async () => {
                      try {
                        // Update workflow step
                        updateWorkflow({
                          steps: [{
                            name: 'Generate Read YAMLs',
                            status: 'in-progress',
                            timestamp: new Date(),
                            details: `Generating Read YAMLs for ${generatedYamlFiles.length} files`
                          }]
                        });
                        
                        // Generate read YAML for each write YAML
                        for (let i = 0; i < generatedYamlFiles.length; i++) {
                          const file = generatedYamlFiles[i];
                          
                          // Create a file object from the YAML content
                          const blob = new Blob([file.content], { type: 'text/plain' });
                          const yamlFile = new File([blob], file.filename, { type: 'text/plain' });
                          
                          await generateReadYaml(yamlFile, csvPathInput, pkInput);
                        }
                        
                        setHasCompletedGeneration(true);
                      } catch (error) {
                        console.error('Error generating read YAMLs:', error);
                      }
                    }}
                    startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : null}
                  >
                    {isProcessing ? 'Generating...' : 'Generate Read YAML Files'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        {/* Tab 2: Custom Generation */}
        {tabValue === 2 && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader 
                title="Custom Read YAML Generation" 
                titleTypographyProps={{ variant: 'h6' }}
                avatar={<VisibilityIcon color="primary" />}
              />
              <Divider />
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      1. Upload Write YAML File
                    </Typography>
                    <FileUpload 
                      accept=".yaml,.yml"
                      multiple={false}
                      maxSize={5 * 1024 * 1024} // 5MB
                      onFilesSelected={handleSingleYamlUpload}
                      isLoading={isProcessing}
                      helperText="Upload a write YAML file"
                      buttonText="Select Write YAML"
                    />
                    
                    {selectedWriteYaml && (
                      <Alert severity="success" icon={<DoneIcon />} sx={{ mt: 2 }}>
                        Selected file: {selectedWriteYaml.name}
                      </Alert>
                    )}
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom>
                      2. Configure Read YAML Generation
                    </Typography>
                    <TextField
                      fullWidth
                      required
                      label="CSV Export Path (from DSBulk unload)"
                      value={csvPathInput}
                      onChange={handleCsvPathInputChange}
                      helperText="Path to the CSV file generated by DSBulk unload"
                      variant="outlined"
                      margin="normal"
                    />
                    <TextField
                      fullWidth
                      required
                      label="Primary Key Column(s)"
                      value={pkInput}
                      onChange={handlePkInputChange}
                      helperText="Comma-separated list of primary key columns"
                      variant="outlined"
                      margin="normal"
                    />
                    
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={!selectedWriteYaml || !pkInput || !csvPathInput || isProcessing}
                        onClick={handleGenerateReadYaml}
                        startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : null}
                      >
                        {isProcessing ? 'Generating...' : 'Generate Read YAML'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        {/* Generated Read YAML Files */}
        {generatedReadYamlFiles && generatedReadYamlFiles.length > 0 && (
          <Grid item xs={12}>
            <YamlViewer 
              files={generatedReadYamlFiles} 
              title="Generated Read YAML Files"
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
              disabled={!hasCompletedGeneration}
            >
              Next: Run NB5 Reader
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ReadYamlView;