import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import CodeIcon from '@mui/icons-material/Code';
import { useAppContext } from '../../context/AppContext';

// Command Generator component for DSBulk and NB5 operations
const CommandGenerator = ({
  title = "Command Generator",
  fields = [],
  initialValues = {},
  onGenerate,
  onExecute,
  onDownload,
  executeLabel = "Execute",
  generateLabel = "Generate Command",
  downloadLabel = "Download Script",
  isGenerating = false,
  isExecuting = false,
  showExecuteButton = true,
  showDownloadButton = true,
  currentCommand = "",
  formDirection = "column", // 'column' or 'row'
}) => {
  const { addNotification } = useAppContext();
  const [formValues, setFormValues] = useState(initialValues);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [commandGenerated, setCommandGenerated] = useState(false);
  
  // Update form values when initialValues changes
  useEffect(() => {
    setFormValues(initialValues);
  }, [initialValues]);
  
  // Update formValues when currentCommand changes
  useEffect(() => {
    if (currentCommand) {
      setCommandGenerated(true);
    }
  }, [currentCommand]);
  
  // Handle form input changes
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    
    // Validate field
    validateField(name, value);
  };
  
  // Validate a single field
  const validateField = (name, value) => {
    const field = fields.find(f => f.name === name);
    
    if (!field) return true;
    
    let isValid = true;
    let errorMessage = "";
    
    // Required validation
    if (field.required && (!value || value.trim() === "")) {
      isValid = false;
      errorMessage = `${field.label} is required`;
    }
    
    // Custom validation
    if (isValid && field.validate && typeof field.validate === 'function') {
      const validationResult = field.validate(value, formValues);
      
      if (validationResult !== true) {
        isValid = false;
        errorMessage = validationResult;
      }
    }
    
    // Update errors state
    setErrors(prev => ({
      ...prev,
      [name]: isValid ? undefined : errorMessage
    }));
    
    return isValid;
  };
  
  // Validate all fields
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;
    
    fields.forEach(field => {
      const value = formValues[field.name];
      
      // Mark all fields as touched
      setTouched(prev => ({ ...prev, [field.name]: true }));
      
      // Required validation
      if (field.required && (!value || (typeof value === 'string' && value.trim() === ""))) {
        newErrors[field.name] = `${field.label} is required`;
        isValid = false;
      }
      
      // Custom validation
      else if (field.validate && typeof field.validate === 'function') {
        const validationResult = field.validate(value, formValues);
        
        if (validationResult !== true) {
          newErrors[field.name] = validationResult;
          isValid = false;
        }
      }
    });
    
    setErrors(newErrors);
    return isValid;
  };
  
  // Handle form submission
  const handleSubmit = (event) => {
    event.preventDefault();
    
    // Validate all fields
    if (!validateForm()) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fix the errors in the form before generating the command',
      });
      return;
    }
    
    // Call onGenerate with form values
    if (onGenerate && typeof onGenerate === 'function') {
      onGenerate(formValues);
      setCommandGenerated(true);
    }
  };
  
  // Copy command to clipboard
  const handleCopyToClipboard = () => {
    if (!currentCommand) return;
    
    navigator.clipboard.writeText(currentCommand)
      .then(() => {
        addNotification({
          type: 'success',
          title: 'Copied to clipboard',
          message: 'Command has been copied to clipboard',
        });
      })
      .catch((err) => {
        console.error('Failed to copy:', err);
        addNotification({
          type: 'error',
          title: 'Copy failed',
          message: 'Failed to copy command to clipboard',
        });
      });
  };
  
  // Execute the command
  const handleExecute = () => {
    if (!currentCommand) return;
    
    if (onExecute && typeof onExecute === 'function') {
      onExecute(currentCommand, formValues);
    }
  };
  
  // Download script
  const handleDownload = () => {
    if (!currentCommand) return;
    
    if (onDownload && typeof onDownload === 'function') {
      onDownload(formValues);
    }
  };
  
  // Reset the form
  const handleReset = () => {
    setFormValues(initialValues);
    setTouched({});
    setErrors({});
    setCommandGenerated(false);
  };
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">{title}</Typography>
        </Box>
        
        <Box component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
          <Grid container spacing={2} direction={formDirection === 'row' ? 'row' : 'column'}>
            {fields.map((field) => (
              <Grid item xs={12} md={formDirection === 'row' ? 'auto' : 12} key={field.name}>
                {field.type === 'select' ? (
                  <FormControl 
                    fullWidth 
                    variant="outlined" 
                    error={touched[field.name] && Boolean(errors[field.name])}
                    required={field.required}
                    size="small"
                  >
                    <InputLabel id={`${field.name}-label`}>{field.label}</InputLabel>
                    <Select
                      labelId={`${field.name}-label`}
                      id={field.name}
                      name={field.name}
                      value={formValues[field.name] || ''}
                      onChange={handleInputChange}
                      label={field.label}
                      disabled={field.disabled || isGenerating || isExecuting}
                    >
                      {(field.options || []).map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                    {touched[field.name] && errors[field.name] && (
                      <FormHelperText>{errors[field.name]}</FormHelperText>
                    )}
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    id={field.name}
                    name={field.name}
                    label={field.label}
                    variant="outlined"
                    size="small"
                    value={formValues[field.name] || ''}
                    onChange={handleInputChange}
                    required={field.required}
                    error={touched[field.name] && Boolean(errors[field.name])}
                    helperText={touched[field.name] && errors[field.name]}
                    disabled={field.disabled || isGenerating || isExecuting}
                    multiline={field.multiline}
                    rows={field.rows || 1}
                    type={field.inputType || 'text'}
                    InputProps={field.inputProps}
                    placeholder={field.placeholder}
                  />
                )}
              </Grid>
            ))}
            
            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={handleReset}
                sx={{ mr: 1 }}
                disabled={isGenerating || isExecuting}
              >
                Reset
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isGenerating || isExecuting}
                startIcon={isGenerating ? <CircularProgress size={20} /> : null}
              >
                {isGenerating ? 'Generating...' : generateLabel}
              </Button>
            </Grid>
          </Grid>
        </Box>
        
        {currentCommand && (
          <>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Generated Command:
              </Typography>
              <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
                <CardContent sx={{ 
                  p: '12px', 
                  '&:last-child': { pb: '12px' },
                  maxHeight: '200px',
                  overflow: 'auto',
                }}>
                  <Box sx={{ display: 'flex' }}>
                    <pre style={{ 
                      margin: 0, 
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      flexGrow: 1
                    }}>
                      {currentCommand}
                    </pre>
                    <Box sx={{ ml: 2, display: 'flex', flexDirection: 'column' }}>
                      <Tooltip title="Copy to clipboard">
                        <IconButton 
                          size="small" 
                          onClick={handleCopyToClipboard}
                          sx={{ mb: 1 }}
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                {showDownloadButton && (
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={handleDownload}
                    sx={{ mr: 1 }}
                    disabled={isExecuting}
                  >
                    {downloadLabel}
                  </Button>
                )}
                
                {showExecuteButton && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={isExecuting ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                    onClick={handleExecute}
                    disabled={isExecuting}
                  >
                    {isExecuting ? 'Executing...' : executeLabel}
                  </Button>
                )}
              </Box>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default CommandGenerator;