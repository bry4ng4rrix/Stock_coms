from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='sale',
            name='customer_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='sale',
            name='is_paid',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='sale',
            name='payment_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='sale',
            name='payment_date',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='sale',
            name='payment_due_date',
            field=models.DateField(blank=True, null=True),
        ),
    ]
