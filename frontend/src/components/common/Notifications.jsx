import React from 'react';
import { 
  Snackbar, 
  Alert, 
  IconButton, 
  Slide 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAppContext } from '../../context/AppContext';

// Slide transition for notifications
function SlideTransition(props) {
  return <Slide {...props} direction="left" />;
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
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          TransitionComponent={SlideTransition}
          sx={{ 
            position: 'relative', 
            mt: index * 6, // Stack notifications
          }}
        >
          <Alert
            severity={notification.type || 'info'}
            sx={{ width: '100%' }}
            action={
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={() => handleClose(notification.id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <strong>{notification.title}</strong>
            {notification.message && (
              <div>{notification.message}</div>
            )}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export default Notifications;