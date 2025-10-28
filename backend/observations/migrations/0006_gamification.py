# Generated migration for GameProfile
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('observations', '0005_add_pred_field'),
    ]

    operations = [
        migrations.CreateModel(
            name='GameProfile',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('points', models.IntegerField(default=0)),
                ('level', models.IntegerField(default=1)),
                ('last_updated', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE,
                 related_name='game_profile', to='auth.user')),
            ],
        ),
    ]
