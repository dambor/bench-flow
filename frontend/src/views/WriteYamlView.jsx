import React, { useState } from 'react';
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
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SchemaIcon from '@mui/icons-material/Schema';
import DescriptionIcon from '@mui/icons-material/Description';
import SettingsIcon from '@mui/icons-material/Settings';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

import FileUpload from '../components/common/FileUpload';
import { useAppContext } from '../context/AppContext';
import { useYamlContext } from '../context/YamlContext';

const WriteYamlView = ({ onNext }) => {
  const { updateWorkflow, addNotification } = useAppContext();
  const { cqlgenApi, generatedYaml, downloadYaml } = useYamlContext();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [schemaFile, setSchemaFile] = useState(null);
  const [confFile, setConfFile] = useState(null);
  const [_generatedResult, setGeneratedResult] = useState(null);
  
  // Handle schema file selection
  const handleSchemaFileSelected = (files) => {
    if (!files || files.length === 0) return;
    setSchemaFile(files[0]);
    
    // Log file information for debugging
    console.log('Schema file selected:', {
      name: files[0].name,
      size: files[0].size,
      type: files[0].type
    });
  };
  
  // Handle configuration file selection
  const handleConfFileSelected = (files) => {
    if (!files || files.length === 0) return;
    setConfFile(files[0]);
    
    // Log file information for debugging
    console.log('Configuration file selected:', {
      name: files[0].name,
      size: files[0].size,
      type: files[0].type
    });
  };
  
  // Generate YAML using the cqlgen API
  const handleGenerateYaml = async () => {
    if (!schemaFile) {
      addNotification({
        type: 'error',
        title: 'Missing Schema File',
        message: 'Please upload a CQL schema file'
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      updateWorkflow({
        steps: [{
          name: 'Generate YAML',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Generating YAML from ${schemaFile.name}`
        }]
      });
      
      // Try the alternative API if available
      let result;
      try {
        console.log('Attempting to use processWithSchema API first...');
        result = await cqlgenApi.processWithSchema(schemaFile, confFile);
        console.log('processWithSchema API succeeded:', result);
      } catch (firstError) {
        console.error('Error with processWithSchema API:', firstError);
        console.log('Falling back to generateYaml API...');
        result = await cqlgenApi.generateYaml(schemaFile, confFile);
        console.log('generateYaml API succeeded:', result);
      }
      
      setGeneratedResult(result);
      
      // The generated YAML content is already stored in the YamlContext
      // by the API methods in the context
      
      if (result.success) {
        addNotification({
          type: 'success',
          title: 'YAML Generated',
          message: 'Successfully generated YAML file'
        });
        
        // Update workflow step as completed
        updateWorkflow({
          steps: [{
            name: 'Generate YAML',
            status: 'completed',
            timestamp: new Date(),
            details: `Generated YAML from ${schemaFile.name}`
          }]
        });
      }
    } catch (error) {
      console.error('Error generating YAML:', error);
      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: error.message || 'Failed to generate YAML'
      });
      
      // Update workflow step as failed
      updateWorkflow({
        steps: [{
          name: 'Generate YAML',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
    } finally {
      setIsProcessing(false);
    }
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
        Create NoSQLBench write workload YAML files from your Cassandra schema using CQLGen
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Upload Schema File */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardHeader 
              title="Upload Schema File" 
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
                isLoading={isProcessing}
                helperText="Drag and drop your CQL schema file here or click to browse"
                buttonText="Select Schema File"
              />
              
              {schemaFile && (
                <Alert 
                  severity="success" 
                  icon={<CheckCircleIcon fontSize="inherit" />}
                  sx={{ mt: 2 }}
                >
                  Schema file selected: {schemaFile.name}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Upload Configuration File (Optional) */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardHeader 
              title="Upload Configuration File (Optional)" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<SettingsIcon color="primary" />}
            />
            <Divider />
            <CardContent>
              <FileUpload 
                accept=".conf,.properties,.yaml,.yml"
                multiple={false}
                maxSize={1 * 1024 * 1024} // 1MB
                onFilesSelected={handleConfFileSelected}
                isLoading={isProcessing}
                helperText="Optionally upload a configuration file for CQLGen"
                buttonText="Select Config File"
              />
              
              {confFile && (
                <Alert 
                  severity="info" 
                  sx={{ mt: 2 }}
                >
                  Configuration file selected: {confFile.name}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
        
        {/* Generate Button */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, mb: 3 }}>
            <Button 
              variant="contained" 
              color="primary"
              size="large"
              onClick={handleGenerateYaml}
              disabled={!schemaFile || isProcessing}
              startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
            >
              {isProcessing ? 'Generating...' : 'Generate YAML File'}
            </Button>
          </Box>
        </Grid>
        
        {/* Generated YAML Result */}
        {generatedYaml.content && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader 
                title="Generated YAML File" 
                titleTypographyProps={{ variant: 'h6' }}
                avatar={<DescriptionIcon color="primary" />}
                action={
                  <Button
                    variant="outlined"
                    startIcon={<CloudDownloadIcon />}
                    onClick={downloadYaml}
                  >
                    Download
                  </Button>
                }
              />
              <Divider />
              <CardContent>
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
                  {generatedYaml.content}
                </Paper>
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