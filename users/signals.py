from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Sale, Product, CustomUser, Notification, EmployerProfile


@receiver(post_save, sender=Sale)
def sale_created(sender, instance: Sale, created, **kwargs):
    if not created:
        return
    try:
        msg = f"Vente: {instance.product.name} x{instance.quantity} — {instance.total_price}"
        Notification.objects.create(notif_type="sale", message=msg, magasin=instance.magasin, sale=instance)
    except Exception:
        pass


@receiver(post_save, sender=Product)
def product_created(sender, instance: Product, created, **kwargs):
    if not created:
        return
    try:
        msg = f"Nouveau produit: {instance.name} ({instance.reference})"
        Notification.objects.create(notif_type="product", message=msg, magasin=instance.magasin, product=instance)
    except Exception:
        pass


@receiver(post_save, sender=CustomUser)
def user_created(sender, instance: CustomUser, created, **kwargs):
    if not created:
        return
    try:
        msg = f"Nouvel utilisateur: {instance.full_name} ({instance.email}) — rôle: {instance.role}"
        magasin = None
        # try to find magasin for employer
        if instance.role == 'employer':
            try:
                emp = EmployerProfile.objects.filter(user=instance).first()
                if emp:
                    magasin = emp.magasin
            except Exception:
                magasin = None
        Notification.objects.create(notif_type="user", message=msg, magasin=magasin, user=instance)
    except Exception:
        pass
