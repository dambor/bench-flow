import React, { createContext, useContext, useState } from 'react';
import { schemaApi } from '../services/api';
import { useAppContext } from './AppContext';

// Create the context
const SchemaContext = createContext();

// Create a hook to use the context
export const useSchemaContext = () => useContext(SchemaContext);

// Provider component
export const SchemaProvider = ({ children }) => {
  const { setError, updateWorkflow } = useAppContext();
  
  // Schema state
  const [schemaData, setSchemaData] = useState(null);
  const [isParsingSchema, setIsParsingSchema] = useState(false);
  const [selectedTables, setSelectedTables] = useState([]);
  const [generatedYamlFiles, setGeneratedYamlFiles] = useState([]);
  
  // Parse a CQL schema file
  const parseSchema = async (schemaFile) => {
    setIsParsingSchema(true);
    
    try {
      const result = await schemaApi.parseSchema(schemaFile);
      setSchemaData(result);
      
      // Extract table names
      const tableNames = Object.keys(result.tables || {});
      setSelectedTables(tableNames);
      /*
      addNotification({
        type: 'success',
        title: 'Schema Parsed',
        message: `Successfully parsed schema with ${tableNames.length} tables`,
      });*/
      
      // Update workflow if active
      updateWorkflow({
        steps: [{
          name: 'Parse Schema',
          status: 'completed',
          timestamp: new Date(),
          details: `Parsed ${schemaFile.name} with ${tableNames.length} tables`
        }]
      });
      
      return result;
    } catch (error) {
      setError(error);
      
      // Update workflow if active
      updateWorkflow({
        steps: [{
          name: 'Parse Schema',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
      
      throw error;
    } finally {
      setIsParsingSchema(false);
    }
  };
  
  // Generate YAML files for selected tables
  const generateYaml = async (tables = selectedTables) => {
    if (!schemaData) {
      setError(new Error('No schema data available. Please parse a schema file first.'));
      return [];
    }
    
    try {
      const result = await schemaApi.generateYaml(schemaData, tables);
      setGeneratedYamlFiles(result.files || []);
      /*
      addNotification({
        type: 'success',
        title: 'YAML Generated',
        message: `Successfully generated ${result.files.length} YAML files`,
      });*/
      
      // Update workflow if active
      updateWorkflow({
        steps: [{
          name: 'Generate YAML',
          status: 'completed',
          timestamp: new Date(),
          details: `Generated ${result.files.length} YAML files for the selected tables`
        }]
      });
      
      return result.files;
    } catch (error) {
      setError(error);
      
      // Update workflow if active
      updateWorkflow({
        steps: [{
          name: 'Generate YAML',
          status: 'failed',
          timestamp: new Date(),
          error: error.message
        }]
      });
      
      throw error;
    }
  };
  
  // Generate a single YAML file
  const generateYamlForTable = async (tableName) => {
    if (!schemaData && !tableName) {
      setError(new Error('No schema data or table name provided.'));
      return null;
    }
    
    try {
      const response = await schemaApi.generateYamlSingle(tableName, schemaData);
      
      // If the response is a direct YAML content as text
      if (typeof response === 'string') {
        return {
          filename: `${tableName.replace('.', '_')}.yaml`,
          content: response,
          table_name: tableName
        };
      }
      
      // If it's a JSON response with file info
      return response;
    } catch (error) {
      setError(error);
      throw error;
    }
  };
  
  // Clear schema data
  const clearSchema = () => {
    setSchemaData(null);
    setSelectedTables([]);
    setGeneratedYamlFiles([]);
  };
  
  // Value object that will be provided to consumers
  const contextValue = {
    schemaData,
    isParsingSchema,
    selectedTables,
    generatedYamlFiles,
    parseSchema,
    generateYaml,
    generateYamlForTable,
    setSelectedTables,
    clearSchema
  };
  
  return (
    <SchemaContext.Provider value={contextValue}>
      {children}
    </SchemaContext.Provider>
  );
};

export default SchemaContext;