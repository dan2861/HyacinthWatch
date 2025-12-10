# TODOs
1. Fix authentication and authorization inconsistencies between using DRF permission handle and custom JWT tokens.

2. Currently running expensive ML inference before checking image quality which wastes compute resource. Fix design so that qc check happens at the beginning.

3. Add background workers so that the app syncs when it goes online.

4. Consider using multiple queues to avoid slow tasks from clogging the pipeline.

5. Add automatic retries to critical tasks with exponential backoff for taks failures.

6. Implement missing feature for app to beocome a strong PWA:
* Service worker is not registered
* Runtime caching for API/Storage
* Offline fallback UX
* Background sync for queued uploads
* Maskable icon
* Screenshots in Manifest
* Service worker cache tuning

7. Update requirements.txt file

# Question
1. How does the react app get the signed urls and directly store the image in the Supabase storage bypassing the backend?