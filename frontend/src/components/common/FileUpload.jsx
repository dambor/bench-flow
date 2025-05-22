import { useState, useRef } from 'react'; // React removed
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Paper,
  Chip,
  Stack,
  IconButton
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// File upload component with drag and drop functionality
const FileUpload = ({
  accept = '*',
  multiple = false,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB by default
  onFilesSelected,
  isLoading = false,
  helperText = 'Drag and drop your file here or click to browse',
  buttonText = 'Select File',
  sx = {}
}) => {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileSelection = (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    // Convert FileList to array
    const fileArray = Array.from(selectedFiles);
    
    // Validate the number of files
    if (!multiple && fileArray.length > 1) {
      setErrors(prev => [...prev, 'Multiple files not allowed']);
      return;
    }
    
    if (multiple && fileArray.length > maxFiles) {
      setErrors(prev => [...prev, `Maximum ${maxFiles} files allowed`]);
      return;
    }
    
    // Validate file types and sizes
    const validFiles = [];
    const newErrors = [];
    
    fileArray.forEach(file => {
      // Check file size
      if (file.size > maxSize) {
        newErrors.push(`File "${file.name}" exceeds the maximum size of ${maxSize / 1024 / 1024}MB`);
        return;
      }
      
      // Check file type if accept is specified
      if (accept !== '*') {
        const acceptedTypes = accept.split(',').map(type => type.trim());
        const fileExtension = `.${file.name.split('.').pop().toLowerCase()}`;
        const fileType = file.type;
        
        const isAccepted = acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            // Extension check (e.g., .jpg, .pdf)
            return fileExtension === type.toLowerCase();
          } else if (type.includes('/*')) {
            // MIME type wildcard (e.g., image/*)
            const mimePrefix = type.split('/')[0];
            return fileType.startsWith(`${mimePrefix}/`);
          } else {
            // Exact MIME type (e.g., application/pdf)
            return fileType === type;
          }
        });
        
        if (!isAccepted) {
          newErrors.push(`File "${file.name}" is not an accepted file type`);
          return;
        }
      }
      
      validFiles.push(file);
    });
    
    // Set errors if any
    if (newErrors.length > 0) {
      setErrors(prev => [...prev, ...newErrors]);
    }
    
    // If no valid files, return
    if (validFiles.length === 0) return;
    
    // Update state with valid files
    if (multiple) {
      setFiles(prev => [...prev, ...validFiles]);
      if (onFilesSelected) onFilesSelected([...files, ...validFiles]);
    } else {
      setFiles(validFiles);
      if (onFilesSelected) onFilesSelected(validFiles);
    }
  };
  
  // Handle file input change
  const handleInputChange = (event) => {
    handleFileSelection(event.target.files);
    // Reset input to allow selecting the same file again
    event.target.value = '';
  };
  
  // Handle drag events
  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = event.dataTransfer.files;
    handleFileSelection(droppedFiles);
  };
  
  // Handle file removal
  const handleRemoveFile = (fileIndex) => {
    const newFiles = files.filter((_, index) => index !== fileIndex);
    setFiles(newFiles);
    if (onFilesSelected) onFilesSelected(newFiles);
  };
  
  // Handle click on the drop zone
  const handleZoneClick = (event) => {
    // Don't trigger if we're clicking on the button
    // This prevents double file picker dialogs
    if (event.target.closest('button') === null) {
      fileInputRef.current?.click();
    }
  };
  
  // Handle file selection button click
  const handleButtonClick = (event) => {
    event.stopPropagation(); // Stop event propagation to prevent double dialogs
    fileInputRef.current?.click();
  };
  
  // Clear all files
  const clearFiles = () => {
    setFiles([]);
    if (onFilesSelected) onFilesSelected([]);
  };
  
  // Clear errors (This function was unused)
  // const clearErrors = () => {
  //   setErrors([]);
  // };
  
  return (
    <Box sx={{ width: '100%', ...sx }}>
      {/* Error display */}
      {errors.length > 0 && (
        <Stack direction="column" spacing={1} sx={{ mb: 2 }}>
          {errors.map((error, index) => (
            <Chip 
              key={index}
              label={error}
              color="error"
              onDelete={() => {
                const newErrors = [...errors];
                newErrors.splice(index, 1);
                setErrors(newErrors);
              }}
            />
          ))}
        </Stack>
      )}
      
      {/* Drop zone */}
      <Paper
        variant="outlined"
        sx={{
          border: isDragging ? '2px dashed' : '2px dashed',
          borderColor: isDragging ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: isDragging ? 'rgba(63, 81, 181, 0.04)' : 'transparent',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.3s, border-color 0.3s',
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleZoneClick}
      >
        {isLoading ? (
          <CircularProgress size={40} />
        ) : (
          <>
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="body1" gutterBottom>
              {helperText}
            </Typography>
            <Button 
              variant="contained" 
              component="span" 
              sx={{ mt: 2 }}
              disabled={isLoading}
              onClick={handleButtonClick}
            >
              {buttonText}
            </Button>
            <input 
              type="file" 
              hidden 
              ref={fileInputRef}
              accept={accept}
              multiple={multiple}
              onChange={handleInputChange}
              disabled={isLoading}
            />
          </>
        )}
      </Paper>
      
      {/* File list */}
      {files.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Selected Files:
          </Typography>
          <Stack direction="column" spacing={1}>
            {files.map((file, index) => (
              <Paper
                key={`${file.name}-${index}`}
                variant="outlined"
                sx={{
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="body2" component="div">
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(file.size / 1024).toFixed(2)} KB
                    </Typography>
                  </Box>
                </Box>
                <IconButton 
                  size="small" 
                  onClick={() => handleRemoveFile(index)}
                  disabled={isLoading}
                >
                  <DeleteIcon />
                </IconButton>
              </Paper>
            ))}
          </Stack>
          
          {files.length > 1 && (
            <Button 
              variant="outlined" 
              color="error" 
              size="small" 
              startIcon={<DeleteIcon />}
              onClick={clearFiles}
              sx={{ mt: 1 }}
              disabled={isLoading}
            >
              Clear All
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default FileUpload;