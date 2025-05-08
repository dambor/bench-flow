import React, { useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ClearIcon from '@mui/icons-material/Clear';
import TerminalIcon from '@mui/icons-material/Terminal';
import { useAppContext } from '../../context/AppContext';

// ConsoleViewer component for displaying command execution output
const ConsoleViewer = ({
  title = "Console Output",
  output = [],
  error = [],
  isLoading = false,
  onClear,
  maxHeight = '400px',
  autoScroll = true
}) => {
  const { addNotification } = useAppContext();
  const consoleRef = useRef(null);
  
  // Auto-scroll to bottom when new output is added
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [output, error, autoScroll]);
  
  // Copy all output to clipboard
  const handleCopyToClipboard = () => {
    const outputText = output.join('\n');
    const errorText = error.length > 0 ? '\n\nERROR OUTPUT:\n' + error.join('\n') : '';
    const fullText = outputText + errorText;
    
    navigator.clipboard.writeText(fullText)
      .then(() => {
        addNotification({
          type: 'success',
          title: 'Copied to clipboard',
          message: 'Console output has been copied to clipboard',
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
  
  // Clear console output
  const handleClear = () => {
    if (onClear && typeof onClear === 'function') {
      onClear();
    }
  };
  
  // Format output line with line numbers
  const formatOutputLine = (line, index) => {
    return (
      <Box component="div" key={index} sx={{ display: 'flex' }}>
        <Typography
          variant="caption"
          component="span"
          sx={{
            color: 'text.secondary',
            minWidth: '40px',
            userSelect: 'none',
            textAlign: 'right',
            mr: 1.5,
            fontFamily: 'monospace',
          }}
        >
          {index + 1}
        </Typography>
        <Typography
          variant="caption"
          component="span"
          sx={{
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {line}
        </Typography>
      </Box>
    );
  };
  
  // No output yet
  const isEmpty = output.length === 0 && error.length === 0 && !isLoading;
  
  return (
    <Paper variant="outlined" sx={{ width: '100%' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', px: 2 }}>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, py: 1.5 }}>
          {title}
        </Typography>
        <Box>
          {!isEmpty && (
            <>
              <Tooltip title="Copy to clipboard">
                <IconButton 
                  size="small" 
                  onClick={handleCopyToClipboard}
                  sx={{ mr: 1 }}
                  disabled={isEmpty}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear console">
                <IconButton 
                  size="small" 
                  onClick={handleClear}
                  disabled={isEmpty}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      </Box>
      
      <Box 
        ref={consoleRef}
        sx={{ 
          p: 2, 
          maxHeight, 
          overflow: 'auto', 
          bgcolor: '#282c34', 
          color: '#f8f8f2',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
        }}
      >
        {isEmpty ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }}>
            <TerminalIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.disabled">
              No console output yet
            </Typography>
          </Box>
        ) : (
          <>
            {output.length > 0 && (
              <Box sx={{ mb: error.length > 0 ? 2 : 0 }}>
                {output.map((line, index) => formatOutputLine(line, index))}
              </Box>
            )}
            
            {error.length > 0 && output.length > 0 && (
              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
            )}
            
            {error.length > 0 && (
              <Box sx={{ color: '#ff5555' }}>
                <Typography variant="caption" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                  ERROR OUTPUT:
                </Typography>
                {error.map((line, index) => formatOutputLine(line, index))}
              </Box>
            )}
            
            {isLoading && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
                <CircularProgress size={16} sx={{ color: 'white', mr: 1 }} />
                <Typography variant="caption">Processing...</Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
};

export default ConsoleViewer;