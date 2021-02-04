#!/usr/bin/Rscript
library(ggplot2)
library(reshape2)
library(extrafont)
library(patchwork) # To display 2 charts together
library(scales)

args <- commandArgs(trailingOnly = TRUE)
csv <- args[1]
basename <- sub(pattern = "(.*)\\..*$", replacement = "\\1", basename(csv))

data <- read.csv(csv)
d1 <- subset(data, NetworkLoad == 'Idle')
d2 <- subset(data, NetworkLoad == 'Busy')
idleMedian <- median(d1$Time)
busyMedian <- median(d2$Time)

plot <- ggplot(data) +
    geom_point(aes(x = NetworkLoad, y = Time), size = 5) +
    geom_hline(yintercept = idleMedian, linetype = 'dashed', color = 'blue') +
    geom_hline(yintercept = busyMedian, linetype = 'dashed', color = 'red') +
    labs(x = 'Network Load Condition', y = 'Time (ms)', title = 'Quectel Software FastShutdown Performance')

ggsave(paste(basename, '.png', sep = ''), plot = plot, width = 5, height = 5)
ggsave(paste(basename, '.pdf', sep = ''), plot = plot, width = 5, height = 5)
