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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  Paper
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorageIcon from '@mui/icons-material/Storage';
import TableChartIcon from '@mui/icons-material/TableChart';
import DoneIcon from '@mui/icons-material/Done';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';

import { useSchemaContext } from '../context/SchemaContext';
import { useAppContext } from '../context/AppContext';

// This is a placeholder component for CDM Migration
// In a real application, you would implement the actual migration functionality
const MigrateView = ({ onNext }) => {
  const { 
    schemaData
  } = useSchemaContext();
  
  const { updateWorkflow, completeWorkflow } = useAppContext();
  
  const [isGeneratingMigration, setIsGeneratingMigration] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [selectedTables, setSelectedTables] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [formValues, setFormValues] = useState({
    source_keyspace: '',
    target_keyspace: 'cdm',
    include_data: true,
    drop_existing: false
  });
  
  // Populate table options when schema data is available
  useEffect(() => {
    if (schemaData && schemaData.tables) {
      const tableNames = Object.keys(schemaData.tables);
      setSelectedTables(tableNames);
      
      // Set source keyspace if available
      if (tableNames.length > 0) {
        const firstTable = schemaData.tables[tableNames[0]];
        if (firstTable && firstTable.keyspace) {
          setFormValues(prev => ({
            ...prev,
            source_keyspace: firstTable.keyspace
          }));
        }
      }
      
      // Generate simulated table comparisons
      const simulatedComparisons = tableNames.map(tableName => {
        const tableInfo = schemaData.tables[tableName];
        const tableParts = tableName.split('.');
        const baseTableName = tableParts.length > 1 ? tableParts[1] : tableName;
        
        return {
          source_table: tableName,
          target_table: `cdm.${baseTableName}`,
          column_count: Object.keys(tableInfo.columns || {}).length,
          primary_key_match: true,
          column_type_mismatches: Math.floor(Math.random() * 2), // 0 or 1 mismatches
          is_compatible: true
        };
      });
      
      setComparisons(simulatedComparisons);
    }
  }, [schemaData]);
  
  // Handle form input changes
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle switch changes
  const handleSwitchChange = (event) => {
    const { name, checked } = event.target;
    setFormValues(prev => ({ ...prev, [name]: checked }));
  };
  
  // Handle table selection changes
  const handleTableSelectionChange = (tableName) => {
    if (selectedTables.includes(tableName)) {
      setSelectedTables(prev => prev.filter(t => t !== tableName));
    } else {
      setSelectedTables(prev => [...prev, tableName]);
    }
  };
  
  // Handle generate migration button click
  const handleGenerateMigration = async () => {
    if (selectedTables.length === 0) {
      return;
    }
    
    setIsGeneratingMigration(true);
    
    try {
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Generate CDM Migration',
          status: 'in-progress',
          timestamp: new Date(),
          details: `Generating migration for ${selectedTables.length} tables`
        }]
      });
      
      // Simulate migration process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Generate CDM Migration',
          status: 'completed',
          timestamp: new Date(),
          details: `Generated migration for ${selectedTables.length} tables`
        }]
      });
      
      setMigrationComplete(true);
    } catch (error) {
      console.error('Error generating migration:', error);
      
      // Update workflow step
      updateWorkflow({
        steps: [{
          name: 'Generate CDM Migration',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
    } finally {
      setIsGeneratingMigration(false);
    }
  };
  
  // Handle next button click - complete the workflow
  const handleFinish = () => {
    // Complete the workflow
    completeWorkflow('completed');
    
    if (onNext && typeof onNext === 'function') {
      onNext();
    }
  };
  
  return (
    <Container maxWidth="xl">
      <Typography variant="h4" component="h1" gutterBottom>
        CDM Migration
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Migrate your schema to the Common Data Model format
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        {/* Configuration Card */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardHeader 
              title="Migration Configuration" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<SettingsIcon color="primary" />}
            />
            <Divider />
            <CardContent>
              <TextField
                fullWidth
                label="Source Keyspace"
                name="source_keyspace"
                value={formValues.source_keyspace}
                onChange={handleInputChange}
                margin="normal"
                disabled={isGeneratingMigration}
              />
              
              <TextField
                fullWidth
                label="Target Keyspace"
                name="target_keyspace"
                value={formValues.target_keyspace}
                onChange={handleInputChange}
                margin="normal"
                disabled={isGeneratingMigration}
                helperText="Target keyspace for the CDM migration"
              />
              
              <Box sx={{ mt: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formValues.include_data}
                      onChange={handleSwitchChange}
                      name="include_data"
                      color="primary"
                      disabled={isGeneratingMigration}
                    />
                  }
                  label="Include Data Migration"
                />
              </Box>
              
              <Box sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formValues.drop_existing}
                      onChange={handleSwitchChange}
                      name="drop_existing"
                      color="primary"
                      disabled={isGeneratingMigration}
                    />
                  }
                  label="Drop Existing Tables"
                />
              </Box>
              
              <Box sx={{ mt: 3 }}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleGenerateMigration}
                  disabled={isGeneratingMigration || selectedTables.length === 0}
                  startIcon={isGeneratingMigration ? <CircularProgress size={20} color="inherit" /> : <CompareArrowsIcon />}
                >
                  {isGeneratingMigration ? 'Generating...' : 'Generate Migration'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Table Selection Card */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardHeader 
              title="Table Selection" 
              titleTypographyProps={{ variant: 'h6' }}
              avatar={<TableChartIcon color="primary" />}
              subheader={`${selectedTables.length} tables selected`}
            />
            <Divider />
            <CardContent sx={{ p: 0 }}>
              <List dense sx={{ maxHeight: '400px', overflow: 'auto' }}>
                {comparisons.map((comparison) => {
                  const isSelected = selectedTables.includes(comparison.source_table);
                  
                  return (
                    <ListItem 
                      key={comparison.source_table}
                      dense
                      divider
                      button
                      onClick={() => handleTableSelectionChange(comparison.source_table)}
                      disabled={isGeneratingMigration}
                      secondaryAction={
                        comparison.is_compatible ? (
                          <Chip 
                            size="small" 
                            icon={<CheckCircleIcon />} 
                            label="Compatible" 
                            color="success" 
                          />
                        ) : (
                          <Chip 
                            size="small" 
                            icon={<WarningIcon />} 
                            label="Incompatible" 
                            color="error" 
                          />
                        )
                      }
                    >
                      <ListItemIcon>
                        <Switch
                          edge="start"
                          checked={isSelected}
                          disabled={isGeneratingMigration}
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={comparison.source_table}
                        secondary={
                          <Box component="span" sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="caption" component="span">
                              Target: {comparison.target_table}
                            </Typography>
                            <Typography variant="caption" component="span">
                              {comparison.column_count} columns, {comparison.column_type_mismatches} type mismatch(es)
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        {/* Migration Result Card */}
        {migrationComplete && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardHeader 
                title="Migration Result" 
                titleTypographyProps={{ variant: 'h6' }}
                avatar={<DoneIcon color="success" />}
              />
              <Divider />
              <CardContent>
                <Alert 
                  severity="success" 
                  icon={<CheckCircleIcon fontSize="inherit" />}
                  sx={{ mb: 2 }}
                >
                  Migration plan generated successfully for {selectedTables.length} tables!
                </Alert>
                
                <Typography variant="body1" paragraph>
                  The migration plan has been generated and is ready to be executed. The plan includes:
                </Typography>
                
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Schema Changes
                      </Typography>
                      <Typography variant="body2">
                        • {selectedTables.length} tables to migrate
                      </Typography>
                      <Typography variant="body2">
                        • {Object.keys(schemaData?.types || {}).length} user-defined types
                      </Typography>
                      <Typography variant="body2">
                        • {formValues.drop_existing ? 'Existing tables will be dropped' : 'Existing tables will be preserved'}
                      </Typography>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Data Migration
                      </Typography>
                      <Typography variant="body2">
                        • {formValues.include_data ? 'Data will be migrated' : 'No data migration'}
                      </Typography>
                      <Typography variant="body2">
                        • Estimated rows: 1,500,000
                      </Typography>
                      <Typography variant="body2">
                        • Estimated time: 25 minutes
                      </Typography>
                    </Paper>
                  </Grid>
                  
                  <Grid item xs={12} md={4}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Target Environment
                      </Typography>
                      <Typography variant="body2">
                        • Keyspace: {formValues.target_keyspace}
                      </Typography>
                      <Typography variant="body2">
                        • Replication strategy: SimpleStrategy
                      </Typography>
                      <Typography variant="body2">
                        • Replication factor: 3
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
                
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Note: This is a simulated migration plan. In a real application, 
                    you would implement the actual migration functionality.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
        
        {/* Next Button */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleFinish}
              endIcon={<NavigateNextIcon />}
              disabled={!migrationComplete}
            >
              Finish Workflow
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default MigrateView;