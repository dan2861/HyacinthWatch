"""Merge migration to resolve concurrent 0007 heads.

This migration depends on both existing 0007 leaf migrations and has no
operations; it simply tells Django that both branches have been reconciled.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('observations', '0007_add_user_to_observation'),
        ('observations', '0007_merge_0006_deletionlog_0006_gamification'),
    ]

    operations = [
    ]
