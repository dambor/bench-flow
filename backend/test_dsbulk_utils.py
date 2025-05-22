import unittest
import os
from backend.dsbulk_utils import DSBulkManager

class TestDSBulkManager(unittest.TestCase):

    def setUp(self):
        # Define a dummy path for dsbulk.jar for testing purposes
        # In a real scenario, this might point to a mock or a test version
        self.dummy_dsbulk_path = "/tmp/dummy_dsbulk.jar"
        # Create a dummy file to simulate dsbulk.jar existence for validate_dsbulk_path()
        os.makedirs(os.path.dirname(self.dummy_dsbulk_path), exist_ok=True)
        with open(self.dummy_dsbulk_path, 'w') as f:
            f.write('') # create empty file

        self.dsbulk_manager = DSBulkManager(dsbulk_path=self.dummy_dsbulk_path)
        self.keyspace = "test_keyspace"
        self.table = "test_table"
        self.primary_key = "id"
        self.output_path = "/tmp/output_data.csv"
        self.csv_path = "/tmp/input_data.csv"

    def tearDown(self):
        # Clean up the dummy dsbulk.jar file
        if os.path.exists(self.dummy_dsbulk_path):
            os.remove(self.dummy_dsbulk_path)

    def test_generate_unload_command_secure(self):
        command_args = self.dsbulk_manager.generate_unload_command(
            keyspace=self.keyspace,
            table=self.table,
            primary_key=self.primary_key,
            output_path=self.output_path,
            limit=100
        )
        self.assertIsInstance(command_args, list, "Command should be a list of arguments")
        self.assertEqual(command_args[0], "java")
        self.assertEqual(command_args[1], "-jar")
        self.assertEqual(command_args[2], self.dummy_dsbulk_path)
        self.assertEqual(command_args[3], "unload")
        self.assertEqual(command_args[4], "-query")
        expected_query = f'SELECT "{self.primary_key}" FROM "{self.keyspace}"."{self.table}" LIMIT 100;'
        self.assertEqual(command_args[5], expected_query, "Query string should be a single argument")
        self.assertEqual(command_args[6], "-url")
        self.assertEqual(command_args[7], self.output_path)

    def test_generate_unload_command_with_problematic_chars(self):
        keyspace_problem = "ks;name"
        table_problem = "tbl'name"
        pk_problem = "id`echo bad`"
        output_path_problem = "/tmp/output$(whoami).csv"

        command_args = self.dsbulk_manager.generate_unload_command(
            keyspace=keyspace_problem,
            table=table_problem,
            primary_key=pk_problem,
            output_path=output_path_problem,
            limit=50
        )
        self.assertIsInstance(command_args, list)
        expected_query = f'SELECT "{pk_problem}" FROM "{keyspace_problem}"."{table_problem}" LIMIT 50;'
        self.assertEqual(command_args[5], expected_query, "Problematic characters should be treated as literals in query")
        self.assertEqual(command_args[7], output_path_problem, "Output path should be literal")
        
        # Ensure no argument itself contains shell metacharacters that would be expanded
        # if shell=True was used (which it isn't, as we get a list)
        for arg in command_args:
            self.assertNotIn(";", arg.split("=")[-1] if "=" in arg else arg, "Arguments should not be split by semicolons if not intended") # Check parts of args
            self.assertNotIn("$(", arg, "Shell command substitution should not be present as unquoted part of arg")


    def test_generate_load_command_secure(self):
        command_args = self.dsbulk_manager.generate_load_command(
            keyspace=self.keyspace,
            table=self.table,
            csv_path=self.csv_path
        )
        self.assertIsInstance(command_args, list, "Command should be a list of arguments")
        self.assertEqual(command_args[0], "java")
        self.assertEqual(command_args[3], "load")
        self.assertEqual(command_args[4], "-k")
        self.assertEqual(command_args[5], self.keyspace)
        self.assertEqual(command_args[6], "-t")
        self.assertEqual(command_args[7], self.table)
        self.assertEqual(command_args[8], "-url")
        self.assertEqual(command_args[9], self.csv_path)

    def test_generate_load_command_with_spaces_in_path(self):
        csv_path_with_spaces = "/tmp/my data/input.csv"
        command_args = self.dsbulk_manager.generate_load_command(
            keyspace=self.keyspace,
            table=self.table,
            csv_path=csv_path_with_spaces
        )
        self.assertEqual(command_args[9], csv_path_with_spaces, "Path with spaces should be a single argument")

    def test_generate_count_command_secure(self):
        command_args = self.dsbulk_manager.generate_count_command(
            keyspace=self.keyspace,
            table=self.table
        )
        self.assertIsInstance(command_args, list, "Command should be a list of arguments")
        self.assertEqual(command_args[0], "java")
        self.assertEqual(command_args[3], "count")
        self.assertEqual(command_args[4], "-k")
        self.assertEqual(command_args[5], self.keyspace)
        self.assertEqual(command_args[6], "-t")
        self.assertEqual(command_args[7], self.table)

    def test_execute_command_validate_path_fail(self):
        # Test that execute_command fails if dsbulk_path is invalid
        invalid_manager = DSBulkManager(dsbulk_path="/invalid/path/to/dsbulk.jar")
        with self.assertRaises(FileNotFoundError): # Expecting FileNotFoundError due to validate_dsbulk_path
            invalid_manager.execute_command(["java", "-jar", "/invalid/path/to/dsbulk.jar", "count"])

if __name__ == '__main__':
    unittest.main()
```
