# .github

Configuración de GitHub del proyecto.

Los pipelines de CI/CD (**GitHub Actions**) se redactan en la **Fase 5** y vivirán
en `.github/workflows/`. Previstos:

- **Backend:** test → build de imagen Docker → push a ECR → update de ECS.
- **Frontend:** build → sync a S3 → invalidación de CloudFront.

> Nota: el directorio `workflows/` se crea al añadir el primer workflow. Para
> subir workflows, el token/credencial de GitHub debe incluir el scope `workflow`.
