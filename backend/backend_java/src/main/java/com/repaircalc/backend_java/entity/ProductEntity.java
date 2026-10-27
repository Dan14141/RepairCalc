package com.repaircalc.backend_java.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import java.math.BigDecimal;

@Entity
@Table(name = "products")
public class ProductEntity {
    @Id
    private String id;
    private String name;
    private String brand;
    private String category;
    @Column(precision = 18, scale = 2)
    private BigDecimal price;
    private String unit;
    private double coverage;
    private String color;
    private String texture;
    private boolean wet;
    private boolean heavy;
    private String rating;
    @Column(columnDefinition = "text")
    private String description;
    private String sourceCategory;
    private String url;

    // Пустой конструктор нужен для Hibernate
    public ProductEntity() {}

    // Геттеры и сеттеры (можно сгенерировать через Alt+Insert в IDEA)
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public double getCoverage() { return coverage; }
    public void setCoverage(double coverage) { this.coverage = coverage; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getTexture() { return texture; }
    public void setTexture(String texture) { this.texture = texture; }
    public boolean isWet() { return wet; }
    public void setWet(boolean wet) { this.wet = wet; }
    public boolean isHeavy() { return heavy; }
    public void setHeavy(boolean heavy) { this.heavy = heavy; }
    public String getRating() { return rating; }
    public void setRating(String rating) { this.rating = rating; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSourceCategory() { return sourceCategory; }
    public String getUrl() { return url; }
}
