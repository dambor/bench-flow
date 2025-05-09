// Modify your Notifications.jsx component to prevent any popup notifications
// by adding a filter for specific notification types or messages

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
  
  // Filter out specific notifications you don't want to show
  const filteredNotifications = notifications.filter(notification => {
    // Hide "Workflow Started" notifications
    if (notification.title === 'Workflow Started' && 
        notification.message && 
        notification.message.includes('has been created')) {
      return false;
    }
    
    // Hide "Workflow Resumed" notifications
    if (notification.title === 'Workflow Resumed') {
      return false;
    }
    
    // Keep all other notifications
    return true;
  });
  
  // No notifications to show, don't render anything
  if (!filteredNotifications.length) {
    return null;
  }
  
  // Handle notification close
  const handleClose = (id) => {
    removeNotification(id);
  };
  
  return (
    <>
      {filteredNotifications.map((notification, index) => (
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