// Updated Notifications.jsx component with simpler, less intrusive styling

// React removed
import { 
  Snackbar, 
  // Alert removed
  IconButton, 
  Slide,
  Box,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAppContext } from '../../context/AppContext';

// Simple slide transition from top
function SlideTransition(props) {
  return <Slide {...props} direction="down" />;
}

// Notifications component displays all active notifications
const Notifications = () => {
  const { notifications, removeNotification } = useAppContext();
  
  // No notifications, don't render anything
  if (!notifications.length) {
    return null;
  }
  
  // Handle notification close
  const handleClose = (id) => {
    removeNotification(id);
  };
  
  return (
    <>
      {notifications.map((notification, index) => (
        <Snackbar
          key={`${notification.id}-${index}`}
          open={true}
          autoHideDuration={notification.duration || 3000}
          onClose={() => handleClose(notification.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          TransitionComponent={SlideTransition}
          sx={{ 
            top: index * 60,  // Stack notifications from the top
            '& .MuiSnackbarContent-root': {
              minWidth: 'auto',
              boxShadow: 1
            }
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: notification.type === 'error' ? 'error.light' : 
                      notification.type === 'warning' ? 'warning.light' : 
                      notification.type === 'success' ? 'success.light' : 'info.light',
              py: 0.75,
              px: 2,
              borderRadius: 1,
              maxWidth: '90vw',
              boxShadow: 1
            }}
          >
            <Typography 
              variant="body2" 
              sx={{ 
                color: notification.type === 'error' ? 'error.dark' : 
                       notification.type === 'warning' ? 'warning.dark' : 
                       notification.type === 'success' ? 'success.dark' : 'info.dark',
                fontWeight: 'medium'
              }}
            >
              {notification.message || notification.title}
            </Typography>
            <IconButton
              size="small"
              color="inherit"
              sx={{ 
                ml: 1, 
                p: 0.25,
                color: notification.type === 'error' ? 'error.dark' : 
                       notification.type === 'warning' ? 'warning.dark' : 
                       notification.type === 'success' ? 'success.dark' : 'info.dark',
              }}
              onClick={() => handleClose(notification.id)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Snackbar>
      ))}
    </>
  );
};

export default Notifications;