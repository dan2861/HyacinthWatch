# HyacinthWatch

HyacinthWatch is a citizen-science system for monitoring the spread of invasive water hyacinth. It combines a progressive web app (PWA) for offline field data collection with a backend pipeline for image quality control, segmentation, and coverage estimation, plus a researcher portal for visualization and ecological analysis.

## 🌟 Features

### For Citizen Scientists
- **PWA Photo Capture**: Take photos of water hyacinth with automatic GPS location
- **Offline Support**: Continue collecting data even without internet connection
- **Simple Interface**: Easy-to-use form for recording observations

### For Researchers
- **Web Portal**: Comprehensive dashboard for viewing and analyzing observations
- **Interactive Map**: Visualize observations geographically
- **Quality Control**: Review and score observation quality
- **Data Export**: Export data for further analysis

### Backend System
- **Automated QC**: AI-powered quality assessment of submitted photos
- **Image Segmentation**: Automatic water hyacinth coverage estimation
- **RESTful API**: Full API for mobile and web applications
- **User Management**: Role-based access (citizen, researcher, admin)

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PWA Frontend  │    │ Researcher Web  │    │  Mobile Apps    │
│   (React)       │    │    Portal       │    │   (Future)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Django API    │
                    │   (REST + Auth) │
                    └─────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
   │   PostgreSQL    │  │  Celery Workers │  │     Redis       │
   │   (Database)    │  │   (QC + ML)     │  │   (Cache/Queue) │
   └─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 🚀 Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone https://github.com/dan2861/HyacinthWatch.git
   cd HyacinthWatch
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Run migrations**
   ```bash
   docker-compose exec web python manage.py migrate
   ```

5. **Create superuser**
   ```bash
   docker-compose exec web python manage.py createsuperuser
   ```

6. **Access the application**
   - API: http://localhost:8000/api/
   - Admin: http://localhost:8000/admin/
   - Frontend: http://localhost:3000/

## 💻 Development Setup

### Backend (Django)

1. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up database**
   ```bash
   # Start PostgreSQL and Redis (or use Docker)
   docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
   docker run -d --name redis -p 6379:6379 redis:7-alpine
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env file with your database credentials
   ```

5. **Run migrations**
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

6. **Start development server**
   ```bash
   python manage.py runserver
   ```

7. **Start Celery worker** (in another terminal)
   ```bash
   celery -A backend worker -l info
   ```

### Frontend (React)

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm start
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## 📱 PWA Features

- **Installable**: Can be installed on mobile devices and desktop
- **Offline Ready**: Service worker caches essential resources
- **Camera Integration**: Direct access to device camera for photo capture
- **GPS Location**: Automatic location capture for observations
- **Responsive Design**: Works on all screen sizes

## 🔧 API Endpoints

### Observations
- `GET /api/observations/` - List observations
- `POST /api/observations/` - Create observation
- `GET /api/observations/{id}/` - Get observation details
- `PATCH /api/observations/{id}/` - Update observation
- `POST /api/observations/{id}/process/` - Trigger processing

### Quality Control
- `GET /api/qc-scores/` - List QC scores
- `POST /api/qc-scores/` - Create QC score

### User Management
- `GET /api/profile/` - Get user profile
- `PATCH /api/profile/` - Update user profile

### Statistics
- `GET /api/stats/` - Get observation statistics

## 🧪 Testing

### Backend Tests
```bash
python manage.py test
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Integration Tests
```bash
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

## 🚀 Deployment

### Production with Docker
1. Set production environment variables
2. Use `docker-compose.prod.yml` for production deployment
3. Set up reverse proxy (nginx) for SSL termination
4. Configure database backups
5. Set up monitoring and logging

### Environment Variables
- `SECRET_KEY` - Django secret key
- `DEBUG` - Set to False in production
- `ALLOWED_HOSTS` - Comma-separated list of allowed hosts
- `DB_*` - Database configuration
- `CELERY_*` - Celery/Redis configuration

## 📊 Monitoring

- Health checks available at `/health/`
- Admin interface at `/admin/`
- API documentation at `/api/schema/`
- Celery monitoring with Flower (optional)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built for ecological monitoring and citizen science
- Supports water hyacinth invasion research
- Contributions welcome from the open source community

## 📞 Support

For questions and support:
- Create an issue on GitHub
- Check the documentation in `/docs/`
- Contact the development team
