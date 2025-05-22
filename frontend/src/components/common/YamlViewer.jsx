import { useState } from 'react'; // React removed
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Button,
  Tooltip,
  Divider
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import CodeIcon from '@mui/icons-material/Code';
import { useAppContext } from '../../context/AppContext';

// YAML Viewer component to display and manage YAML files
const YamlViewer = ({ files = [], onDownload, title = "Generated YAML Files" }) => {
  const { addNotification } = useAppContext();
  const [currentTab, setCurrentTab] = useState(0);
  
  // No files to display
  if (!files || files.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CodeIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          No YAML files to display
        </Typography>
      </Paper>
    );
  }
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };
  
  // Copy YAML content to clipboard
  const handleCopyToClipboard = (content) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        addNotification({
          type: 'success',
          title: 'Copied to clipboard',
          message: 'YAML content has been copied to clipboard',
        });
      })
      .catch((err) => {
        console.error('Failed to copy:', err);
        addNotification({
          type: 'error',
          title: 'Copy failed',
          message: 'Failed to copy content to clipboard',
        });
      });
  };
  
  // Download a YAML file
  const handleDownload = (file) => {
    // If custom download handler is provided, use it
    if (onDownload && typeof onDownload === 'function') {
      onDownload(file);
      return;
    }
    
    // Default download behavior using Blob
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
    addNotification({
      type: 'success',
      title: 'File Downloaded',
      message: `${file.filename} has been downloaded`,
    });
  };
  
  // Calculate current file
  const currentFile = files[currentTab] || files[0];
  
  return (
    <Box sx={{ width: '100%' }}>
      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', px: 2 }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1, py: 1.5 }}>
            {title}
          </Typography>
          <Box>
            <Tooltip title="Copy to clipboard">
              <IconButton 
                size="small" 
                onClick={() => handleCopyToClipboard(currentFile.content)}
                sx={{ mr: 1 }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download file">
              <IconButton 
                size="small" 
                onClick={() => handleDownload(currentFile)}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        
        {files.length > 1 && (
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2 }}
          >
            {files.map((file) => ( // index removed
              <Tab
                key={file.filename} // Changed key to file.filename
                label={file.filename}
                sx={{ textTransform: 'none' }}
              />
            ))}
          </Tabs>
        )}
        
        <Divider />
        
        <Box sx={{ p: 2, maxHeight: '500px', overflow: 'auto', bgcolor: 'grey.50' }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
            {currentFile.content}
          </pre>
        </Box>
        
        {files.length > 1 && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', borderTop: 1, borderColor: 'divider' }}>
            <Button 
              variant="outlined" 
              size="small"
              disabled={currentTab === 0}
              onClick={() => setCurrentTab(prev => Math.max(0, prev - 1))}
            >
              Previous
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {currentTab + 1} of {files.length}
            </Typography>
            <Button 
              variant="outlined" 
              size="small"
              disabled={currentTab === files.length - 1}
              onClick={() => setCurrentTab(prev => Math.min(files.length - 1, prev + 1))}
            >
              Next
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default YamlViewer;