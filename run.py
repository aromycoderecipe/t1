# 기본 템플릿
from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
  return "aws home page"

if __name__ == "__main__":
  app.run(debug=True)

# 기본플라스크 서버파일 생성 