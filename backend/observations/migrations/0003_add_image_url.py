from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('observations', '0002_observation_qc_observation_qc_score'),
    ]

    operations = [
        migrations.AddField(
            model_name='observation',
            name='image_url',
            field=models.URLField(blank=True, null=True),
        ),
    ]
