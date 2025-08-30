from flask import Flask, request, jsonify, render_template
import joblib
import json
import os
import pandas as pd

app = Flask(__name__)

# Load artifacts
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "Predictive_backend/artifacts")

pipeline_path = os.path.join(ARTIFACTS_DIR, "pipeline_ridge.joblib")
model = joblib.load(pipeline_path)

metadata_path = os.path.join(ARTIFACTS_DIR, "model_metadata.json")
with open(metadata_path, "r") as f:
    metadata = json.load(f)

# Use ALL expected features from metadata (21 features total)
EXPECTED_FEATURES = metadata.get("feature_names", [])

# Frontend Routes
@app.route("/home")
def home():
    return render_template('index.html')

@app.route("/student-login")
def student_login():
    return render_template('student_login.html')

@app.route("/student-questionnaire")
def student_questionnaire():
    return render_template('student_questionnaire.html')

@app.route("/admin-login")
def admin_login():
    return render_template('admin_login.html')

@app.route("/admin-dashboard")
def admin_dashboard():
    return render_template('admin_dashboard.html')

# API Routes
@app.route("/api/info")
def api_info():
    return jsonify({
        "message": "Student GPA Prediction API is running 🚀",
        "expected_features": EXPECTED_FEATURES,
        "target": metadata.get("target", "First_Year_GPA_Average")
    })

@app.route("/api/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        if not data:
            return jsonify({"error": "No input data provided"}), 400

        # Use ALL expected features from metadata and ensure correct order
        features = {f: data.get(f, 0) for f in EXPECTED_FEATURES}
        X = pd.DataFrame([features])

        # Predict GPA
        predicted_gpa = float(model.predict(X)[0])

        # Suggestions based on GPA category
        if predicted_gpa < 2.5:
            suggestions = [
                "Low performance — book an advisor meeting and consider tutoring.",
                "Improve attendance, create a study schedule and use practice problems."
            ]
        elif predicted_gpa < 4.0:
            suggestions = [
                "Moderate performance — increase focused study time and practice past papers.",
                "Attend tutorials and consider study groups."
            ]
        else:  # GPA >= 4.0
            suggestions = [
                "Excellent performance — continue current study routines and peer mentoring.",
                "Maintain strong note-taking and time management."
            ]

        return jsonify({
            "predicted_gpa": round(predicted_gpa, 2),
            "suggestions": suggestions
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)