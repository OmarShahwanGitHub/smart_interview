import re
import pickle
import streamlit as st
from PyPDF2 import PdfReader

# ── Load models ───────────────────────────────────────────────────────────────

@st.cache_resource
def load_models():
    return {
        "cat_clf":   pickle.load(open('models/rf_classifier_categorization.pkl', 'rb')),
        "cat_tfidf": pickle.load(open('models/tfidf_vectorizer_categorization.pkl', 'rb')),
        "job_clf":   pickle.load(open('models/rf_classifier_job_recommendation.pkl', 'rb')),
        "job_tfidf": pickle.load(open('models/tfidf_vectorizer_job_recommendation.pkl', 'rb')),
    }

# ── Text processing ───────────────────────────────────────────────────────────

def cleanResume(txt):
    cleanText = re.sub('http\S+\s', ' ', txt)
    cleanText = re.sub('RT|cc', ' ', cleanText)
    cleanText = re.sub('#\S+\s', ' ', cleanText)
    cleanText = re.sub('@\S+', '  ', cleanText)
    cleanText = re.sub('[%s]' % re.escape("""!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~"""), ' ', cleanText)
    cleanText = re.sub(r'[^\x00-\x7f]', ' ', cleanText)
    cleanText = re.sub('\s+', ' ', cleanText)
    return cleanText

def predict_category(resume_text, models):
    cleaned = cleanResume(resume_text)
    tfidf = models["cat_tfidf"].transform([cleaned])
    return models["cat_clf"].predict(tfidf)[0]

def job_recommendation(resume_text, models):
    cleaned = cleanResume(resume_text)
    tfidf = models["job_tfidf"].transform([cleaned])
    return models["job_clf"].predict(tfidf)[0]

def pdf_to_text(file) -> str:
    reader = PdfReader(file)
    return ''.join(page.extract_text() or '' for page in reader.pages)

def extract_contact_number_from_resume(text):
    pattern = r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
    match = re.search(pattern, text)
    return match.group() if match else None

def extract_email_from_resume(text):
    pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"
    match = re.search(pattern, text)
    return match.group() if match else None

def extract_name_from_resume(text):
    pattern = r"(\b[A-Z][a-z]+\b)\s(\b[A-Z][a-z]+\b)"
    match = re.search(pattern, text)
    return match.group() if match else None

def extract_skills_from_resume(text):
    skills_list = [
        'Python', 'Data Analysis', 'Machine Learning', 'Communication', 'Project Management', 'Deep Learning', 'SQL',
        'Tableau', 'Java', 'C++', 'JavaScript', 'HTML', 'CSS', 'React', 'Angular', 'Node.js', 'MongoDB',
        'Express.js', 'Git', 'Research', 'Statistics', 'Quantitative Analysis', 'Qualitative Analysis', 'SPSS', 'R',
        'Data Visualization', 'Matplotlib', 'Seaborn', 'Plotly', 'Pandas', 'Numpy', 'Scikit-learn', 'TensorFlow',
        'Keras', 'PyTorch', 'NLTK', 'Text Mining', 'Natural Language Processing', 'Computer Vision',
        'Image Processing', 'OCR', 'Speech Recognition', 'Recommendation Systems', 'Collaborative Filtering',
        'Reinforcement Learning', 'Neural Networks', 'Convolutional Neural Networks', 'Recurrent Neural Networks',
        'Generative Adversarial Networks', 'XGBoost', 'Random Forest', 'Decision Trees', 'Support Vector Machines',
        'Linear Regression', 'Logistic Regression', 'K-Means Clustering', 'Apache Hadoop', 'Apache Spark',
        'MapReduce', 'Hive', 'Apache Kafka', 'ETL', 'Big Data Analytics', 'Cloud Computing',
        'Amazon Web Services (AWS)', 'Microsoft Azure', 'Google Cloud Platform (GCP)', 'Docker', 'Kubernetes',
        'Linux', 'Shell Scripting', 'Cybersecurity', 'Network Security', 'Penetration Testing', 'Encryption',
        'CI/CD', 'DevOps', 'Agile Methodology', 'Scrum', 'Kanban', 'Software Development', 'Web Development',
        'Mobile Development', 'Backend Development', 'Frontend Development', 'Full-Stack Development',
        'UI/UX Design', 'Figma', 'Sketch', 'Product Management', 'Market Research', 'Business Development',
        'Sales', 'Marketing', 'SEO', 'Google Analytics', 'Salesforce', 'HubSpot', 'Quality Assurance',
        'Selenium', 'API Testing', 'Technical Writing', 'WordPress', 'Django', 'Flask', 'FastAPI',
        'PostgreSQL', 'MySQL', 'SQLite', 'Redis', 'Elasticsearch', 'Firebase', 'AWS Lambda', 'Blockchain',
        'Smart Contracts', 'Web3', 'Swift', 'Kotlin', 'Flutter', 'React Native', 'Unity', 'Unreal Engine',
    ]
    return [s for s in skills_list if re.search(r"\b{}\b".format(re.escape(s)), text, re.IGNORECASE)]

def extract_education_from_resume(text):
    education_keywords = [
        'Computer Science', 'Information Technology', 'Software Engineering', 'Electrical Engineering',
        'Mechanical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Biomedical Engineering',
        'Data Science', 'Data Analytics', 'Business Analytics', 'Cybersecurity', 'Information Security',
        'Network Engineering', 'Human-Computer Interaction', 'Business Administration', 'Finance', 'Accounting',
        'Economics', 'Marketing', 'Psychology', 'Mathematics', 'Statistics', 'Physics', 'Biology', 'Chemistry',
        'Architecture', 'Graphic Design', 'Industrial Design', 'Communication Studies', 'Journalism',
        'Political Science', 'International Relations', 'Public Health', 'Nursing', 'Medicine', 'Pharmacy',
        'Environmental Science', 'Renewable Energy', 'Blockchain Technology',
    ]
    return [kw for kw in education_keywords
            if re.search(r"(?i)\b{}\b".format(re.escape(kw)), text)]


# ── Streamlit UI ──────────────────────────────────────────────────────────────

st.set_page_config(page_title="Resume Predictor", layout="centered")
st.title("Resume Predictor")
st.caption("Upload a resume to get category prediction, job recommendation, and extracted info.")

models = load_models()

uploaded = st.file_uploader("Upload resume (PDF or TXT)", type=["pdf", "txt"])

if uploaded:
    with st.spinner("Analysing resume…"):
        if uploaded.name.endswith(".pdf"):
            text = pdf_to_text(uploaded)
        else:
            text = uploaded.read().decode("utf-8")

        if not text.strip():
            st.error("Could not extract text. Make sure the PDF is not a scanned image.")
            st.stop()

        category   = predict_category(text, models)
        job        = job_recommendation(text, models)
        name       = extract_name_from_resume(text)
        phone      = extract_contact_number_from_resume(text)
        email      = extract_email_from_resume(text)
        skills     = extract_skills_from_resume(text)
        education  = extract_education_from_resume(text)

    # ── Results ───────────────────────────────────────────────────────────────

    col1, col2 = st.columns(2)
    col1.metric("Resume Category", category)
    col2.metric("Recommended Job", job)

    st.divider()
    st.subheader("Extracted Info")

    info_col1, info_col2, info_col3 = st.columns(3)
    info_col1.markdown(f"**Name**  \n{name or '—'}")
    info_col2.markdown(f"**Email**  \n{email or '—'}")
    info_col3.markdown(f"**Phone**  \n{phone or '—'}")

    st.divider()

    if skills:
        st.subheader("Skills Detected")
        st.write(", ".join(skills))

    if education:
        st.subheader("Education Fields Detected")
        st.write(", ".join(education))
