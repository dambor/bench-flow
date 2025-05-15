# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
python cqlgen_app.py server

# Or process files directly
python cqlgen_app.py schema.cql output.yaml